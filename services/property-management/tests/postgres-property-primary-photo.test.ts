import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CreateProperty, PostgresPropertyPhotoRepository, PostgresPropertyRepository,
  PostgresPropertyPhotoStandardRepository, InvalidPropertyPhotoContentError,
  PropertyPhotoNotFoundError, PropertyPrimaryPhotoDeletionForbiddenError,
  PropertyPublishedPhotoMutationForbiddenError, ReorderPropertyPhotos,
  PropertyPublicationRequirementsNotMetError, PublishProperty, SelectPropertyPrimaryPhoto,
  WithdrawPropertyFromCatalog,
  UpdatePropertyDetails, assessPropertyPhotoReadiness,
  type PropertyAuthority, type PropertyPhotoValues,
} from "../src/index.js";
import { propertyPhotos } from "../src/infrastructure/persistence/postgres/schema.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "11111111-1111-4111-8111-111111111111";
const PROPERTY_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PHOTO_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CORRELATION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const NOW = "2026-08-30T10:00:00.000Z";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
let container: StartedTestContainer; let owner: Pool; let runtime: Pool;

function connection(user: string, password: string, database = "property_photo_test") {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/${database}`;
}

const authority: PropertyAuthority = {
  actorId: "tenant-admin", authorityId: "tenant-admin",
  grants: ["CREATE_PROPERTY", "UPDATE_PROPERTY_DETAILS", "PUBLISH_PROPERTY", "WITHDRAW_PROPERTY_FROM_CATALOG", "SELECT_PROPERTY_PRIMARY_PHOTO", "DELETE_PROPERTY_PHOTO", "RETRIEVE_PROPERTY_PHOTOS", "REORDER_PROPERTY_PHOTOS"],
  tenantIds: [TENANT_A],
};

beforeAll(async () => {
  container = await new GenericContainer(IMAGE)
    .withEnvironment({ POSTGRES_DB: "property_photo_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner" })
    .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  owner = new Pool({ connectionString: connection("owner", "synthetic-owner") });
  await owner.query("CREATE ROLE monpiole_runtime LOGIN PASSWORD 'synthetic-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await owner.query("CREATE ROLE monpiole_public_catalog_reader LOGIN PASSWORD 'synthetic-public-reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(owner), { migrationsFolder });
  await owner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    property_management.properties,
    property_management.property_owners,
    property_management.property_ownerships,
    property_management.property_buildings,
    property_management.property_building_units
    TO monpiole_runtime`);
  runtime = new Pool({ connectionString: connection("monpiole_runtime", "synthetic-runtime") });
});
afterEach(async () => owner.query("TRUNCATE property_management.property_viewings, property_management.property_inquiries, property_management.property_amenities, property_management.property_contracts, property_management.property_clients, property_management.property_primary_photo_audits, property_management.property_photo_standards, property_management.property_photos, property_management.property_geolocations, property_management.property_building_units, property_management.property_buildings, property_management.property_ownerships, property_management.properties, property_management.property_owners"));
afterAll(async () => { await runtime?.end(); await owner?.end(); await container?.stop(); });

async function createReady(propertyId = PROPERTY_A) {
  const properties = new PostgresPropertyRepository(runtime);
  await new CreateProperty(properties, { generate: () => propertyId }, { now: () => NOW }).execute({
    authority, correlationId: CORRELATION, title: "Maison Lagune", propertyType: "HOUSE", transactionType: "SALE",
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
  await new UpdatePropertyDetails(properties, { now: () => "2026-08-30T10:05:00.000Z" }).execute({
    authority, correlationId: CORRELATION, propertyId, details: { rooms: 4 },
    commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 100_000_000 },
  });
  return properties;
}

async function createApartmentReady(subtype: "STUDIO" | "MULTI_ROOM") {
  const properties = new PostgresPropertyRepository(runtime);
  await new CreateProperty(properties, { generate: () => PROPERTY_A }, { now: () => NOW }).execute({
    authority, correlationId: CORRELATION, title: "Appartement Lagune", propertyType: "APARTMENT",
    transactionType: "LONG_TERM_RENTAL", apartmentSubtype: subtype,
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
  await new UpdatePropertyDetails(properties, { now: () => "2026-08-30T10:05:00.000Z" }).execute({
    authority, correlationId: CORRELATION, propertyId: PROPERTY_A, details: { rooms: subtype === "STUDIO" ? 1 : 3 },
    commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH" },
  });
  return properties;
}

async function insertPhoto(photoId: string, propertyId = PROPERTY_A, category: PropertyPhotoValues["category"] = "BUILDING_EXTERIOR_OR_ENTRANCE") {
  await withTenantPostgresTransaction(runtime, TENANT_A, async (scope) => {
    const count = await scope.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM property_management.property_photos WHERE property_id=$1 AND gallery_position IS NOT NULL",
      [propertyId],
    );
    await scope.database().insert(propertyPhotos).values({
      photoId, tenantId: TENANT_A, propertyId, category, status: "AVAILABLE",
      mediaKind: "IMAGE", galleryPosition: Number(count[0]?.count ?? "0"),
      url: null, isPrimary: false, contentBase64: "iVBORw0KGgo=", contentType: "image/png",
      contentByteSize: 8, contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
      registeredAt: NOW, availableAt: "2026-08-30T10:01:00.000Z",
    });
  });
}

function selector() {
  return new SelectPropertyPrimaryPhoto(new PostgresPropertyPhotoRepository(runtime), { now: () => "2026-08-30T10:10:00.000Z" });
}

describe("PostgreSQL primary Property photo", () => {
  it("migre 0015 vers 0016 sans perdre les lignes legacy ni l’ordre déterministe", async () => {
    const previousMigrations = await migrationsThrough(15);
    await owner.query("CREATE DATABASE property_media_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_media_upgrade_test") });
    try {
      await migrate(drizzle(upgrade), { migrationsFolder: previousMigrations });
      await upgrade.query(`INSERT INTO property_management.properties
        (property_id,tenant_id,title,property_type,transaction_type,status,structural_role,country,city,district,address_line,
         created_at,updated_at,correlation_id,actor_id)
        VALUES ($1,$2,'Galerie historique','HOUSE','SALE','DRAFT','STANDALONE','CI','Abidjan','Cocody','Riviera',now(),now(),$3,'legacy')`,
      [PROPERTY_A, TENANT_A, CORRELATION]);
      await upgrade.query(`INSERT INTO property_management.property_photos
        (photo_id,tenant_id,property_id,category,status,url,is_primary,registered_at,available_at)
        VALUES ($1,$2,$3,'OTHER','AVAILABLE','https://legacy.example/photo.jpg',true,'2026-08-30T09:00:00Z','2026-08-30T09:00:00Z')`,
      [PHOTO_A, TENANT_A, PROPERTY_A]);
      for (const [photoId, registeredAt] of [[PHOTO_B, "2026-08-30T10:00:00Z"], ["11111111-1111-4111-8111-111111111111", "2026-08-30T09:30:00Z"]]) {
        await upgrade.query(`INSERT INTO property_management.property_photos
          (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,content_byte_size,content_sha256,registered_at,available_at)
          VALUES ($1,$2,$3,'OTHER','AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
            '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',$4,$4)`,
        [photoId, TENANT_A, PROPERTY_A, registeredAt]);
      }
      await migrate(drizzle(upgrade), { migrationsFolder });
      expect((await upgrade.query(`SELECT photo_id,media_kind,gallery_position,is_primary,url
        FROM property_management.property_photos ORDER BY gallery_position NULLS LAST,photo_id`)).rows).toEqual([
        { photo_id: "11111111-1111-4111-8111-111111111111", media_kind: "IMAGE", gallery_position: 0, is_primary: false, url: null },
        { photo_id: PHOTO_B, media_kind: "IMAGE", gallery_position: 1, is_primary: false, url: null },
        { photo_id: PHOTO_A, media_kind: "IMAGE", gallery_position: null, is_primary: true, url: "https://legacy.example/photo.jpg" },
      ]);
    } finally {
      await upgrade.end();
      await rm(previousMigrations, { recursive: true, force: true });
    }
  });

  it("applique 0010 et accorde exactement les privilèges photo nécessaires à monpiole_runtime", async () => {
    const privileges = (await owner.query(`SELECT table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE table_schema = 'property_management' AND grantee = 'monpiole_runtime'
        AND table_name IN ('property_photos', 'property_photo_standards', 'property_primary_photo_audits')
      ORDER BY table_name, privilege_type`)).rows;
    expect(privileges).toEqual([
      { table_name: "property_photo_standards", privilege_type: "INSERT" },
      { table_name: "property_photo_standards", privilege_type: "SELECT" },
      { table_name: "property_photo_standards", privilege_type: "UPDATE" },
      { table_name: "property_photos", privilege_type: "DELETE" },
      { table_name: "property_photos", privilege_type: "INSERT" },
      { table_name: "property_photos", privilege_type: "SELECT" },
      { table_name: "property_photos", privilege_type: "UPDATE" },
      { table_name: "property_primary_photo_audits", privilege_type: "INSERT" },
      { table_name: "property_primary_photo_audits", privilege_type: "SELECT" },
    ]);
    expect((await runtime.query("SELECT current_user, has_schema_privilege(current_user, 'property_management', 'USAGE') AS schema_usage")).rows[0])
      .toEqual({ current_user: "monpiole_runtime", schema_usage: true });
  });

  it("préserve une publication 0008 historique sans faire compter sa simple URL à l’avenir", async () => {
    const previousMigrations = await migrationsThrough(8);
    await owner.query("CREATE DATABASE property_photo_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_photo_upgrade_test") });
    try {
      await migrate(drizzle(upgrade), { migrationsFolder: previousMigrations });
      await upgrade.query(`INSERT INTO property_management.properties
        (property_id, tenant_id, title, property_type, transaction_type, status,
         country, city, district, address_line, rooms, commercial_kind, currency, sale_price_amount_minor,
         created_at, updated_at, correlation_id, actor_id)
        VALUES ($1,$2,'Bien historique','HOUSE','SALE','DRAFT','CI','Abidjan','Cocody','Riviera',
          1,'SALE','XOF',100000000,now(),now(),$3,'historical')`, [PROPERTY_A, TENANT_A, CORRELATION]);
      await upgrade.query(`INSERT INTO property_management.property_photos
        (photo_id, tenant_id, property_id, category, status, url, is_primary, registered_at, available_at)
        VALUES ($1,$2,$3,'EXTERIOR','AVAILABLE','https://legacy.example/photo.jpg',true,now(),now())`,
      [PHOTO_A, TENANT_A, PROPERTY_A]);
      await upgrade.query(`UPDATE property_management.properties SET status='PUBLISHED', published_at=now(),
        published_by_actor_id='historical', publication_correlation_id=$2 WHERE property_id=$1`, [PROPERTY_A, CORRELATION]);

      await migrate(drizzle(upgrade), { migrationsFolder });

      expect((await upgrade.query(`SELECT status, photo_standard_version FROM property_management.properties
        WHERE property_id=$1`, [PROPERTY_A])).rows[0]).toEqual({ status: "PUBLISHED", photo_standard_version: null });
      expect((await upgrade.query(`SELECT url, content_base64 FROM property_management.property_photos
        WHERE photo_id=$1`, [PHOTO_A])).rows[0]).toEqual({ url: "https://legacy.example/photo.jpg", content_base64: null });
    } finally {
      await upgrade.end();
      await rm(previousMigrations, { recursive: true, force: true });
    }
  });

  it("persiste le contenu avant de déclarer une photo disponible", async () => {
    await createReady();
    const repository = new PostgresPropertyPhotoRepository(runtime);
    await expect(repository.register(TENANT_A, PROPERTY_A, {
      photoId: PHOTO_A, category: "BUILDING_EXTERIOR_OR_ENTRANCE", contentType: "image/png",
      contentBase64: "iVBORw0KGgo=", registeredAt: NOW, correlationId: CORRELATION, actorId: "tenant-admin",
    })).resolves.toEqual([expect.objectContaining({ photoId: PHOTO_A, mediaKind: "IMAGE", position: 0, isPrimary: false, contentByteSize: 8 })]);
    await expect(repository.retrieveContent(TENANT_A, PROPERTY_A, PHOTO_A)).resolves.toMatchObject({
      contentBase64: "iVBORw0KGgo=", contentType: "image/png", contentByteSize: 8,
    });
    await expect(repository.register(TENANT_A, PROPERTY_A, {
      photoId: PHOTO_B, category: "OTHER", contentType: "image/jpeg",
      contentBase64: "iVBORw0KGgo=", registeredAt: NOW, correlationId: CORRELATION, actorId: "tenant-admin",
    })).rejects.toBeInstanceOf(InvalidPropertyPhotoContentError);
  });

  it("réordonne transactionnellement, rejoue sans divergence et compacte après suppression", async () => {
    await createReady(); await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B);
    const repository = new PostgresPropertyPhotoRepository(runtime);
    const reorder = new ReorderPropertyPhotos(repository);
    const command = { authority, propertyId: PROPERTY_A, photoIds: [PHOTO_B, PHOTO_A] };
    await expect(reorder.execute(command)).resolves.toMatchObject([
      { photoId: PHOTO_B, position: 0 }, { photoId: PHOTO_A, position: 1 },
    ]);
    await expect(reorder.execute(command)).resolves.toMatchObject([
      { photoId: PHOTO_B, position: 0 }, { photoId: PHOTO_A, position: 1 },
    ]);
    await expect(reorder.execute({ ...command, photoIds: [PHOTO_A, PHOTO_A] })).rejects.toMatchObject({ code: "INVALID_PROPERTY_PHOTO_ORDER" });
    await expect(reorder.execute({ ...command, photoIds: [PHOTO_A, "11111111-1111-4111-8111-111111111111"] }))
      .rejects.toMatchObject({ code: "INVALID_PROPERTY_PHOTO_ORDER" });
    await repository.delete(TENANT_A, PROPERTY_A, PHOTO_B);
    await expect(repository.list(TENANT_A, PROPERTY_A)).resolves.toMatchObject([{ photoId: PHOTO_A, position: 0 }]);
  });

  it("contraint les positions et sérialise deux réorganisations concurrentes", async () => {
    await createReady(); await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B);
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "UPDATE property_management.property_photos SET gallery_position=0 WHERE photo_id=$1", [PHOTO_B],
    ))).rejects.toMatchObject({ code: "23505", constraint: "property_photos_gallery_position_unique_idx" });
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      `INSERT INTO property_management.property_photos
        (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,content_byte_size,content_sha256,registered_at,available_at)
       VALUES ($1,$2,$3,'OTHER','AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
         '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now())`,
      [randomUUID(), TENANT_A, PROPERTY_A],
    ))).rejects.toMatchObject({ code: "23514", constraint: "property_photos_gallery_position_check" });
    const reorder = new ReorderPropertyPhotos(new PostgresPropertyPhotoRepository(runtime));
    await Promise.all([
      reorder.execute({ authority, propertyId: PROPERTY_A, photoIds: [PHOTO_B, PHOTO_A] }),
      reorder.execute({ authority, propertyId: PROPERTY_A, photoIds: [PHOTO_A, PHOTO_B] }),
    ]);
    const gallery = await new PostgresPropertyPhotoRepository(runtime).list(TENANT_A, PROPERTY_A);
    expect(gallery?.map((photo) => photo.position)).toEqual([0, 1]);
    expect(new Set(gallery?.map((photo) => photo.photoId)).size).toBe(2);
  });

  it("refuse de rendre invalide la galerie d’un bien publié", async () => {
    const properties = await createReady();
    await new PostgresPropertyPhotoStandardRepository(runtime).save(TENANT_A, {
      minimumCount: 2, additionalRequiredCategories: ["OTHER"],
    }, { updatedAt: NOW, correlationId: CORRELATION, actorId: "tenant-admin" });
    await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B, PROPERTY_A, "OTHER");
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    await new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" })
      .execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A });
    const repository = new PostgresPropertyPhotoRepository(runtime);
    await expect(repository.delete(TENANT_A, PROPERTY_A, PHOTO_B))
      .rejects.toBeInstanceOf(PropertyPublishedPhotoMutationForbiddenError);
    await expect(repository.list(TENANT_A, PROPERTY_A)).resolves.toHaveLength(2);
  });

  it("refuse aussi une insertion SQL directe déjà publiée sans contenu photo", async () => {
    await expect(owner.query(`INSERT INTO property_management.properties
      (property_id, tenant_id, title, property_type, transaction_type, status,
       country, city, district, address_line, rooms, commercial_kind, currency, sale_price_amount_minor,
       created_at, updated_at, correlation_id, actor_id, published_at, published_by_actor_id, publication_correlation_id)
      VALUES ($1,$2,'Publication directe','HOUSE','SALE','PUBLISHED','CI','Abidjan','Cocody','Riviera',
        1,'SALE','XOF',100000000,now(),now(),$3,'direct-sql',now(),'direct-sql',$3)`,
    [PROPERTY_A, TENANT_A, CORRELATION])).rejects.toMatchObject({
      code: "23514", constraint: "properties_published_photo_standard_guard",
    });
  });

  it("refuse la publication sans photo principale puis autorise une photo conforme", async () => {
    const properties = await createReady();
    await insertPhoto(PHOTO_A);
    const publish = new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" });
    await expect(publish.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A }))
      .rejects.toMatchObject({ missingRequirements: ["PRIMARY_PHOTO"] });
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      `UPDATE property_management.properties SET status='PUBLISHED', published_at=$2,
        published_by_actor_id='direct-sql', publication_correlation_id=$3, updated_at=$2
       WHERE property_id=$1`, [PROPERTY_A, "2026-08-30T10:20:00.000Z", CORRELATION],
    ))).rejects.toMatchObject({ code: "23514", constraint: "properties_published_photo_standard_guard" });
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    await expect(publish.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A }))
      .resolves.toMatchObject({ outcome: "PUBLISHED", property: { status: "PUBLISHED", photos: [{ photoId: PHOTO_A, isPrimary: true }] } });
  });

  it("refuse une photo appartenant à un autre bien du même tenant", async () => {
    await createReady(PROPERTY_A); await createReady(PROPERTY_B); await insertPhoto(PHOTO_A, PROPERTY_B);
    await expect(selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A }))
      .rejects.toBeInstanceOf(PropertyPhotoNotFoundError);
    expect(await new PostgresPropertyPhotoRepository(runtime).list(TENANT_A, PROPERTY_A)).toEqual([]);
  });

  it("sérialise deux sélections concurrentes et ne conserve qu’une photo principale", async () => {
    await createReady(); await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B, PROPERTY_A, "LIVING_ROOM_OR_MAIN_ROOM");
    const select = selector();
    await Promise.all([
      select.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A }),
      select.execute({ authority, correlationId: "11111111-1111-4111-8111-111111111111", propertyId: PROPERTY_A, photoId: PHOTO_B }),
    ]);
    const photos = await new PostgresPropertyPhotoRepository(runtime).list(TENANT_A, PROPERTY_A);
    expect(photos?.filter((photo) => photo.isPrimary)).toHaveLength(1);
    const databaseCount = await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM property_management.property_photos WHERE property_id = $1 AND is_primary", [PROPERTY_A],
    ));
    expect(databaseCount[0]?.count).toBe("1");
  });

  it("autorise et audite le remplacement après publication", async () => {
    const properties = await createReady(); await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B, PROPERTY_A, "LIVING_ROOM_OR_MAIN_ROOM");
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    await new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" })
      .execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A });
    await selector().execute({ authority, correlationId: "11111111-1111-4111-8111-111111111111", propertyId: PROPERTY_A, photoId: PHOTO_B });
    const audits = await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query<{
      previous_photo_id: string | null; selected_photo_id: string; property_status: string; actor_id: string;
    }>("SELECT previous_photo_id, selected_photo_id, property_status, actor_id FROM property_management.property_primary_photo_audits WHERE selected_photo_id = $1", [PHOTO_B]));
    expect(audits).toEqual([{ previous_photo_id: PHOTO_A, selected_photo_id: PHOTO_B, property_status: "PUBLISHED", actor_id: "tenant-admin" }]);
  });

  it("autorise et audite le remplacement privé après retrait du catalogue", async () => {
    const properties = await createReady(); await insertPhoto(PHOTO_A); await insertPhoto(PHOTO_B, PROPERTY_A, "LIVING_ROOM_OR_MAIN_ROOM");
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    await new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" })
      .execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A });
    await new WithdrawPropertyFromCatalog(properties, { now: () => "2026-08-30T10:30:00.000Z" })
      .execute({ authority, correlationId: "11111111-1111-4111-8111-111111111111", propertyId: PROPERTY_A });
    await new SelectPropertyPrimaryPhoto(new PostgresPropertyPhotoRepository(runtime), { now: () => "2026-08-30T10:40:00.000Z" })
      .execute({ authority, correlationId: "22222222-2222-4222-8222-222222222222", propertyId: PROPERTY_A, photoId: PHOTO_B });
    const audits = await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query<{
      previous_photo_id: string | null; selected_photo_id: string; property_status: string;
    }>("SELECT previous_photo_id, selected_photo_id, property_status FROM property_management.property_primary_photo_audits WHERE selected_photo_id = $1", [PHOTO_B]));
    expect(audits).toEqual([{ previous_photo_id: PHOTO_A, selected_photo_id: PHOTO_B, property_status: "WITHDRAWN" }]);
  });

  it("refuse la suppression principale sans remplacement et protège aussi la suppression SQL", async () => {
    const properties = await createReady(); await insertPhoto(PHOTO_A);
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    await new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" })
      .execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A });
    const photos = new PostgresPropertyPhotoRepository(runtime);
    await expect(photos.delete(TENANT_A, PROPERTY_A, PHOTO_A)).rejects.toBeInstanceOf(PropertyPrimaryPhotoDeletionForbiddenError);
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "DELETE FROM property_management.property_photos WHERE photo_id = $1", [PHOTO_A],
    ))).rejects.toThrow(/replacement/iu);
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "UPDATE property_management.property_photos SET is_primary=false WHERE photo_id = $1", [PHOTO_A],
    ))).rejects.toMatchObject({ code: "23514", constraint: "properties_published_photo_standard_guard" });
  });

  it("compte la photo principale dans le minimum et dans sa catégorie", () => {
    const photo: PropertyPhotoValues = { photoId: PHOTO_A, tenantId: TENANT_A, propertyId: PROPERTY_A,
      mediaKind: "IMAGE", position: 0,
      category: "BUILDING_EXTERIOR_OR_ENTRANCE", status: "AVAILABLE", contentType: "image/png", contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
      registeredAt: NOW, availableAt: NOW };
    expect(assessPropertyPhotoReadiness([photo])).toMatchObject({
      minimumCount: 1, availableCount: 1, primaryPhoto: photo, categoryCounts: { BUILDING_EXTERIOR_OR_ENTRANCE: 1 },
    });
  });

  it("publie un Studio avec six photos sans salon ni chambre séparés", async () => {
    const properties = await createApartmentReady("STUDIO");
    const categories = [
      "BUILDING_EXTERIOR_OR_ENTRANCE", "MAIN_LIVING_SLEEPING_AREA", "KITCHEN_OR_KITCHENETTE",
      "BATHROOM_OR_SHOWER_ROOM", "OTHER", "OTHER",
    ] as const;
    const ids: string[] = [];
    for (const category of categories) {
      const id = randomUUID(); ids.push(id); await insertPhoto(id, PROPERTY_A, category);
    }
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: ids[0]! });
    await expect(new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" }).execute({
      authority, correlationId: CORRELATION, propertyId: PROPERTY_A,
    })).resolves.toMatchObject({ outcome: "PUBLISHED" });
  });

  it("refuse une vue Multi-room manquante malgré une quantité suffisante", async () => {
    const properties = await createApartmentReady("MULTI_ROOM");
    const ids = Array.from({ length: 7 }, () => randomUUID());
    const categories = [
      "BUILDING_EXTERIOR_OR_ENTRANCE", "LIVING_ROOM_OR_MAIN_ROOM", "BEDROOM_OR_SLEEPING_AREA",
      "BATHROOM_OR_SHOWER_ROOM", "OTHER", "OTHER", "OTHER",
    ] as const;
    for (const [index, category] of categories.entries()) await insertPhoto(ids[index]!, PROPERTY_A, category);
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: ids[0]! });
    await expect(new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" }).execute({
      authority, correlationId: CORRELATION, propertyId: PROPERTY_A,
    })).rejects.toMatchObject({ missingRequirements: ["PHOTO_REQUIRED_VIEWS"] });
  });

  it("applique transactionnellement les renforcements de l’organisation", async () => {
    const properties = await createApartmentReady("STUDIO");
    await new PostgresPropertyPhotoStandardRepository(runtime).save(TENANT_A, {
      minimumCount: 7, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"],
    }, { updatedAt: NOW, correlationId: CORRELATION, actorId: "tenant-admin" });
    const base = [
      "BUILDING_EXTERIOR_OR_ENTRANCE", "MAIN_LIVING_SLEEPING_AREA", "KITCHEN_OR_KITCHENETTE",
      "BATHROOM_OR_SHOWER_ROOM", "OTHER", "OTHER",
    ] as const;
    const ids: string[] = [];
    for (const category of base) { const id = randomUUID(); ids.push(id); await insertPhoto(id, PROPERTY_A, category); }
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: ids[0]! });
    const publish = new PublishProperty(properties, { now: () => "2026-08-30T10:20:00.000Z" });
    await expect(publish.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A }))
      .rejects.toMatchObject({ missingRequirements: ["PHOTO_MINIMUM", "PHOTO_REQUIRED_VIEWS"] });
    await insertPhoto(randomUUID(), PROPERTY_A, "BEDROOM_OR_SLEEPING_AREA");
    await expect(publish.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A }))
      .resolves.toMatchObject({ outcome: "PUBLISHED" });
  });

  it("refuse tout accès inter-tenant aux trois tables photo", async () => {
    const tenantBAuthority = { ...authority, tenantIds: [TENANT_B] };
    await new CreateProperty(new PostgresPropertyRepository(runtime), { generate: () => PROPERTY_B }, { now: () => NOW }).execute({
      authority: tenantBAuthority, correlationId: CORRELATION, title: "Bien tenant B",
      propertyType: "HOUSE", transactionType: "SALE",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Tenant B" },
    });
    await new PostgresPropertyPhotoRepository(runtime).register(TENANT_B, PROPERTY_B, {
      photoId: PHOTO_B, category: "OTHER", contentType: "image/png", contentBase64: "iVBORw0KGgo=",
      registeredAt: NOW, correlationId: CORRELATION, actorId: "tenant-b-admin",
    });
    await new PostgresPropertyPhotoStandardRepository(runtime).save(TENANT_B, {
      minimumCount: 2, additionalRequiredCategories: ["OTHER"],
    }, { updatedAt: NOW, correlationId: CORRELATION, actorId: "tenant-b-admin" });
    await new SelectPropertyPrimaryPhoto(new PostgresPropertyPhotoRepository(runtime), { now: () => NOW }).execute({
      authority: tenantBAuthority, correlationId: CORRELATION, propertyId: PROPERTY_B, photoId: PHOTO_B,
    });

    await expect(new PostgresPropertyRepository(runtime).findById(TENANT_A, PROPERTY_B)).resolves.toBeUndefined();
    const hiddenRows = await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query<{ source: string }>(`
      SELECT 'photo' AS source FROM property_management.property_photos WHERE tenant_id = $1
      UNION ALL SELECT 'standard' FROM property_management.property_photo_standards WHERE tenant_id = $1
      UNION ALL SELECT 'audit' FROM property_management.property_primary_photo_audits WHERE tenant_id = $1`, [TENANT_B]));
    expect(hiddenRows).toEqual([]);
    await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "UPDATE property_management.property_photos SET gallery_position=1 WHERE photo_id=$1", [PHOTO_B],
    ));
    await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "DELETE FROM property_management.property_photos WHERE photo_id=$1", [PHOTO_B],
    ));
    await expect(new PostgresPropertyPhotoRepository(runtime).list(TENANT_B, PROPERTY_B))
      .resolves.toMatchObject([{ photoId: PHOTO_B, position: 0 }]);
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      `INSERT INTO property_management.property_photos
        (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,content_byte_size,content_sha256,
         registered_at,available_at,media_kind,gallery_position)
       VALUES ($1,$2,$3,'OTHER','AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
         '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now(),'IMAGE',1)`,
      [randomUUID(), TENANT_B, PROPERTY_B],
    ))).rejects.toMatchObject({ code: "42501" });
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      `INSERT INTO property_management.property_photo_standards
        (tenant_id, minimum_photo_count, additional_required_categories, updated_at, correlation_id, actor_id)
       VALUES ($1, 2, ARRAY[]::text[], $2, $3, 'tenant-a-admin')`, [TENANT_B, NOW, CORRELATION],
    ))).rejects.toMatchObject({ code: "42501" });
  });

  it("autorise la lecture et l’ajout d’audit mais refuse sa modification et sa suppression", async () => {
    await createReady(); await insertPhoto(PHOTO_A);
    await selector().execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_A, photoId: PHOTO_A });
    const audits = await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query<{ audit_id: string }>(
      "SELECT audit_id FROM property_management.property_primary_photo_audits WHERE selected_photo_id = $1", [PHOTO_A],
    ));
    expect(audits).toHaveLength(1);
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "UPDATE property_management.property_primary_photo_audits SET actor_id = 'forbidden' WHERE audit_id = $1", [audits[0]!.audit_id],
    ))).rejects.toMatchObject({ code: "42501" });
    await expect(withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      "DELETE FROM property_management.property_primary_photo_audits WHERE audit_id = $1", [audits[0]!.audit_id],
    ))).rejects.toMatchObject({ code: "42501" });
  });

  it("active et force la RLS sur les photos, le standard et l’audit", async () => {
    const rows = (await owner.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relnamespace = 'property_management'::regnamespace
        AND relname IN ('property_photos', 'property_photo_standards', 'property_primary_photo_audits') ORDER BY relname`)).rows;
    expect(rows).toEqual([
      { relname: "property_photo_standards", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "property_photos", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "property_primary_photo_audits", relrowsecurity: true, relforcerowsecurity: true },
    ]);
    expect((await owner.query(`SELECT tablename, policyname, cmd, roles,
        qual LIKE '%app.tenant_id%' AS tenant_qual,
        with_check LIKE '%app.tenant_id%' AS tenant_check
      FROM pg_policies WHERE schemaname = 'property_management'
        AND tablename IN ('property_photos', 'property_photo_standards', 'property_primary_photo_audits')
      ORDER BY tablename`)).rows).toEqual([
      { tablename: "property_photo_standards", policyname: "property_photo_standards_tenant_isolation", cmd: "ALL", roles: "{public}", tenant_qual: true, tenant_check: true },
      { tablename: "property_photos", policyname: "property_photos_tenant_isolation", cmd: "ALL", roles: "{public}", tenant_qual: true, tenant_check: true },
      { tablename: "property_photos", policyname: "property_photos_public_catalog_media_select", cmd: "SELECT", roles: "{monpiole_public_catalog_reader}", tenant_qual: false, tenant_check: null },
      { tablename: "property_primary_photo_audits", policyname: "property_primary_photo_audits_tenant_isolation", cmd: "ALL", roles: "{public}", tenant_qual: true, tenant_check: true },
    ]);
  });
});

async function migrationsThrough(lastIndex: number) {
  const folder = await mkdtemp(join(tmpdir(), `monpiole-property-000${lastIndex}-`));
  const meta = join(folder, "meta");
  await mkdir(meta);
  const journal = JSON.parse(await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    readonly entries: readonly { readonly idx: number; readonly tag: string }[];
  };
  for (let index = 0; index <= lastIndex; index += 1) {
    const prefix = String(index).padStart(4, "0");
    const migrationName = `${journal.entries.find((entry) => entry.idx === index)!.tag}.sql`;
    await copyFile(join(migrationsFolder, migrationName), join(folder, migrationName));
    await copyFile(join(migrationsFolder, "meta", `${prefix}_snapshot.json`), join(meta, `${prefix}_snapshot.json`));
  }
  await writeFile(join(meta, "_journal.json"), `${JSON.stringify({ ...journal, entries: journal.entries.filter((entry) => entry.idx <= lastIndex) }, null, 2)}\n`, "utf8");
  return folder;
}
