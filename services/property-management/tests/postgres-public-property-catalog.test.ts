import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PostgresPublicPropertyCatalogQuery } from "../src/index.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_A = "11111111-1111-4111-8111-111111111111";
const PROPERTY_B = "22222222-2222-4222-8222-222222222222";
const PROPERTY_C = "33333333-3333-4333-8333-333333333333";
const DRAFT_PROPERTY = "44444444-4444-4444-8444-444444444444";
const WITHDRAWN_PROPERTY = "55555555-5555-4555-8555-555555555555";
const MEDIA_A = "66666666-6666-4666-8666-666666666666";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

let container: StartedTestContainer;
let owner: Pool;
let reader: Pool;

function connection(user: string, password: string, database = "public_catalog_test") {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/${database}`;
}

beforeAll(async () => {
  container = await new GenericContainer(IMAGE)
    .withEnvironment({ POSTGRES_DB: "public_catalog_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  owner = new Pool({ connectionString: connection("owner", "synthetic-owner") });
  await owner.query("CREATE ROLE monpiole_runtime LOGIN PASSWORD 'synthetic-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await owner.query("CREATE ROLE monpiole_public_catalog_reader LOGIN PASSWORD 'synthetic-public-reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(owner), { migrationsFolder });
  reader = new Pool({ connectionString: connection("monpiole_public_catalog_reader", "synthetic-public-reader"), max: 2 });
});

afterEach(async () => {
  await owner.query("TRUNCATE property_management.property_viewings, property_management.property_inquiries, property_management.property_amenities, property_management.property_contracts, property_management.property_clients, property_management.property_primary_photo_audits, property_management.property_photo_standards, property_management.property_photos, property_management.property_geolocations, property_management.property_building_units, property_management.property_buildings, property_management.property_ownerships, property_management.properties, property_management.property_owners");
});

afterAll(async () => {
  await reader?.end();
  await owner?.end();
  await container?.stop();
});

describe("PostgreSQL public Property catalog boundary", () => {
  it("lists only PUBLISHED rows for the explicit tenant with deterministic keyset pagination", async () => {
    await seedPublished(owner, TENANT_A, PROPERTY_A, "Maison A", "2026-08-31T12:00:00.000Z", "HOUSE", "SALE");
    await seedPublished(owner, TENANT_A, PROPERTY_B, "Maison B", "2026-08-31T11:00:00.000Z", "HOUSE", "SALE");
    await seedPublished(owner, TENANT_A, PROPERTY_C, "Maison C", "2026-08-31T10:00:00.000Z", "HOUSE", "SALE");
    await seedWithdrawn(owner, TENANT_A, WITHDRAWN_PROPERTY, "2026-08-31T11:30:00.000Z");
    await seedDraft(owner, TENANT_A, DRAFT_PROPERTY);
    await seedPublished(owner, TENANT_B, randomUUID(), "Autre tenant", "2026-08-31T13:00:00.000Z", "HOUSE", "SALE");
    const catalog = new PostgresPublicPropertyCatalogQuery(reader);

    const first = await catalog.list({ tenantId: TENANT_A, limit: 1, propertyType: "HOUSE", transactionType: "SALE" });
    expect(first.items.map((item) => item.publicPropertyId)).toEqual([PROPERTY_A]);
    expect(first.items[0]?.commercialTerms).toMatchObject({ agencyFeeAmountMinor: 5_000_000 });
    expect(first.nextCursor).toEqual({ publishedAt: "2026-08-31T12:00:00.000Z", publicPropertyId: PROPERTY_A });
    const second = await catalog.list({ tenantId: TENANT_A, limit: 1, cursor: first.nextCursor });
    expect(second.items.map((item) => item.publicPropertyId)).toEqual([PROPERTY_B]);
    expect(JSON.stringify([...first.items, ...second.items])).not.toMatch(/tenantId|addressLine|actorId|photoId|contentSha256|latitude|longitude|publicVisibility/);
  });

  it("returns the same absence for missing, DRAFT and another tenant", async () => {
    await seedPublished(owner, TENANT_A, PROPERTY_A, "Maison", "2026-08-31T12:00:00.000Z", "HOUSE", "SALE");
    await seedDraft(owner, TENANT_A, DRAFT_PROPERTY);
    await seedWithdrawn(owner, TENANT_A, WITHDRAWN_PROPERTY, "2026-08-31T11:30:00.000Z");
    const catalog = new PostgresPublicPropertyCatalogQuery(reader);
    await expect(catalog.retrieve(TENANT_A, PROPERTY_A)).resolves.toMatchObject({
      publicPropertyId: PROPERTY_A,
      description: "Description publique",
      details: { rooms: 4 },
      location: { country: "CI", city: "Abidjan", district: "Cocody" },
    });
    await expect(catalog.retrieve(TENANT_A, DRAFT_PROPERTY)).resolves.toBeUndefined();
    await expect(catalog.retrieve(TENANT_A, WITHDRAWN_PROPERTY)).resolves.toBeUndefined();
    await expect(catalog.retrieve(TENANT_B, PROPERTY_A)).resolves.toBeUndefined();
    await expect(catalog.retrieve(TENANT_A, randomUUID())).resolves.toBeUndefined();
  });

  it("serves only the content-backed primary photo of a PUBLISHED Property", async () => {
    await seedPublished(owner, TENANT_A, PROPERTY_A, "Maison", "2026-08-31T12:00:00.000Z", "HOUSE", "SALE");
    await seedDraft(owner, TENANT_A, DRAFT_PROPERTY);
    await seedWithdrawn(owner, TENANT_A, WITHDRAWN_PROPERTY, "2026-08-31T11:30:00.000Z");
    const catalog = new PostgresPublicPropertyCatalogQuery(reader);
    await expect(catalog.retrievePrimaryPhoto(TENANT_A, PROPERTY_A)).resolves.toMatchObject({
      contentType: "image/png",
      contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
    });
    await expect(catalog.retrievePrimaryPhoto(TENANT_A, DRAFT_PROPERTY)).resolves.toBeUndefined();
    await expect(catalog.retrievePrimaryPhoto(TENANT_A, WITHDRAWN_PROPERTY)).resolves.toBeUndefined();
    await expect(catalog.retrievePrimaryPhoto(TENANT_B, PROPERTY_A)).resolves.toBeUndefined();
  });

  it("returns the complete ordered gallery and never serves media from a withdrawn or foreign Property", async () => {
    await seedPublished(owner, TENANT_A, PROPERTY_A, "Maison", "2026-08-31T12:00:00.000Z", "HOUSE", "SALE");
    await owner.query(`INSERT INTO property_management.property_photos
      (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,
       content_byte_size,content_sha256,registered_at,available_at,media_kind,gallery_position)
      VALUES ($1,$2,$3,'OTHER','AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
        '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now(),'IMAGE',1)`,
    [MEDIA_A, TENANT_A, PROPERTY_A]);
    await seedWithdrawn(owner, TENANT_A, WITHDRAWN_PROPERTY, "2026-08-31T11:30:00.000Z");
    const withdrawnMediaId = (await owner.query(
      "SELECT photo_id FROM property_management.property_photos WHERE property_id=$1", [WITHDRAWN_PROPERTY],
    )).rows[0].photo_id as string;
    const catalog = new PostgresPublicPropertyCatalogQuery(reader);
    const detail = await catalog.retrieve(TENANT_A, PROPERTY_A);
    expect(detail?.gallery).toMatchObject([
      { kind: "IMAGE", position: 0, isPrimary: true },
      { mediaId: MEDIA_A, kind: "IMAGE", position: 1, isPrimary: false, category: "OTHER" },
    ]);
    await expect(catalog.retrieveMedia(TENANT_A, PROPERTY_A, MEDIA_A)).resolves.toMatchObject({ contentType: "image/png", contentByteSize: 8 });
    await expect(catalog.retrieveMedia(TENANT_B, PROPERTY_A, MEDIA_A)).resolves.toBeUndefined();
    await expect(catalog.retrieveMedia(TENANT_A, WITHDRAWN_PROPERTY, withdrawnMediaId)).resolves.toBeUndefined();
  });

  it("proves forced RLS, restrictive role-targeted policies and the partial index", async () => {
    expect((await owner.query(`SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE nspname = 'property_management' AND relname IN ('properties', 'property_photos')
      ORDER BY relname`)).rows).toEqual([
      { relname: "properties", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "property_photos", relrowsecurity: true, relforcerowsecurity: true },
    ]);
    expect((await owner.query(`SELECT tablename, policyname, permissive, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'property_management' AND policyname LIKE '%public_catalog%'
      ORDER BY tablename`)).rows).toEqual([
      { tablename: "properties", policyname: "properties_public_catalog_published_select", permissive: "RESTRICTIVE", cmd: "SELECT", roles: "{monpiole_public_catalog_reader}" },
      { tablename: "property_photos", policyname: "property_photos_public_catalog_media_select", permissive: "RESTRICTIVE", cmd: "SELECT", roles: "{monpiole_public_catalog_reader}" },
    ]);
    expect((await owner.query(`SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'property_management' AND indexname = 'properties_public_catalog_idx'`)).rows[0])
      .toMatchObject({ indexname: "properties_public_catalog_idx" });
  });

  it("proves the reader role and exact column-level read boundary", async () => {
    expect((await reader.query("SELECT current_user")).rows[0]).toEqual({ current_user: "monpiole_public_catalog_reader" });
    expect((await owner.query(`SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolbypassrls
      FROM pg_roles WHERE rolname = 'monpiole_public_catalog_reader'`)).rows[0]).toEqual({
      rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolbypassrls: false,
    });
    expect((await owner.query(`SELECT
      pg_has_role('monpiole_public_catalog_reader', 'owner', 'MEMBER') AS owner_member,
      count(*)::int AS owned_relations
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      JOIN pg_roles ON pg_roles.oid = pg_class.relowner
      WHERE nspname = 'property_management' AND rolname = 'monpiole_public_catalog_reader'`)).rows[0])
      .toEqual({ owner_member: false, owned_relations: 0 });
    expect((await owner.query(`SELECT table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE table_schema = 'property_management' AND grantee = 'monpiole_public_catalog_reader'`)).rows).toEqual([
        { table_name: "public_property_amenities", privilege_type: "SELECT" },
      ]);
    const columnPrivileges = (await owner.query(`SELECT table_name, column_name, privilege_type
      FROM information_schema.column_privileges
      WHERE table_schema = 'property_management' AND grantee = 'monpiole_public_catalog_reader'`)).rows
      .map((row) => `${row.table_name}.${row.column_name}:${row.privilege_type}`).sort();
    const propertyColumns = [
      "property_id", "tenant_id", "title", "description", "property_type", "transaction_type",
      "apartment_subtype", "status", "structural_role", "country", "city", "district", "published_at",
      "usable_surface_square_meters", "rooms", "bedrooms", "bathrooms", "furnished", "commercial_kind",
      "currency", "rent_amount_minor", "rent_period", "security_deposit_amount_minor", "charges_amount_minor",
      "rate_amount_minor", "pricing_unit", "sale_price_amount_minor", "agency_fee_amount_minor",
      "cleaning_fee_amount_minor", "minimum_stay_nights",
    ];
    const photoColumns = [
      "tenant_id", "property_id", "status", "is_primary", "content_base64", "content_type",
      "content_byte_size", "content_sha256", "photo_id", "category", "media_kind", "gallery_position",
    ];
    const amenityViewColumns = ["property_id", "code", "category", "label_fr", "display_order"];
    expect(columnPrivileges).toEqual([
      ...propertyColumns.map((column) => `properties.${column}:SELECT`),
      ...photoColumns.map((column) => `property_photos.${column}:SELECT`),
      ...amenityViewColumns.map((column) => `public_property_amenities.${column}:SELECT`),
    ].sort());
    expect((await reader.query(`SELECT
      has_schema_privilege(current_user, 'property_management', 'USAGE') AS schema_usage,
      has_schema_privilege(current_user, 'property_management', 'CREATE') AS schema_create,
      has_table_privilege(current_user, 'property_management.properties', 'SELECT') AS whole_property_select,
      has_column_privilege(current_user, 'property_management.properties', 'title', 'SELECT') AS title_select,
      has_column_privilege(current_user, 'property_management.properties', 'address_line', 'SELECT') AS address_select,
      has_column_privilege(current_user, 'property_management.properties', 'pricing_version', 'SELECT') AS pricing_version_select,
      has_table_privilege(current_user, 'property_management.property_owners', 'SELECT') AS owners_select`)).rows[0]).toEqual({
      schema_usage: true,
      schema_create: false,
      whole_property_select: false,
      title_select: true,
      address_select: false,
      pricing_version_select: false,
      owners_select: false,
    });
    await expect(reader.query("SELECT address_line FROM property_management.properties")).rejects.toThrow(/permission denied/iu);
    await expect(reader.query("SELECT * FROM property_management.property_owners")).rejects.toThrow(/permission denied/iu);
    await expect(reader.query("SELECT * FROM property_management.property_primary_photo_audits")).rejects.toThrow(/permission denied/iu);
  });

  it("blocks writes and resets tenant context when a pooled connection is returned", async () => {
    await expect(reader.query("UPDATE property_management.properties SET title = 'forbidden'"))
      .rejects.toThrow(/permission denied/iu);
    await withTenantPostgresTransaction(reader, TENANT_A, async (scope) => {
      expect((await scope.query<{ tenant: string }>("SELECT current_setting('app.tenant_id') AS tenant"))[0])
        .toEqual({ tenant: TENANT_A });
    });
    const client = await reader.connect();
    try {
      expect((await client.query("SELECT current_setting('app.tenant_id', true) AS tenant")).rows[0]).toEqual({ tenant: "" });
    } finally {
      client.release();
    }
  });

  it("upgrades 0010 to 0011 without changing legacy publication data and keeps its photo nullable", async () => {
    const throughEight = await migrationsThrough(8);
    const throughTen = await migrationsThrough(10);
    await owner.query("CREATE DATABASE public_catalog_upgrade_test");
    const upgradeOwner = new Pool({ connectionString: connection("owner", "synthetic-owner", "public_catalog_upgrade_test") });
    try {
      await migrate(drizzle(upgradeOwner), { migrationsFolder: throughEight });
      await seedLegacyPublished(upgradeOwner, TENANT_A, PROPERTY_A);
      await migrate(drizzle(upgradeOwner), { migrationsFolder: throughTen });
      const before = (await upgradeOwner.query("SELECT property_id, status, photo_standard_version FROM property_management.properties")).rows;
      await migrate(drizzle(upgradeOwner), { migrationsFolder });
      expect((await upgradeOwner.query("SELECT property_id, status, photo_standard_version FROM property_management.properties")).rows).toEqual(before);
      const upgradeReader = new Pool({ connectionString: connection("monpiole_public_catalog_reader", "synthetic-public-reader", "public_catalog_upgrade_test") });
      try {
        const catalog = new PostgresPublicPropertyCatalogQuery(upgradeReader);
        const page = await catalog.list({ tenantId: TENANT_A, limit: 20 });
        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toMatchObject({ publicPropertyId: PROPERTY_A, primaryPhoto: null });
        await expect(catalog.retrievePrimaryPhoto(TENANT_A, PROPERTY_A)).resolves.toBeUndefined();
      } finally {
        await upgradeReader.end();
      }
    } finally {
      await upgradeOwner.end();
      await rm(throughEight, { recursive: true, force: true });
      await rm(throughTen, { recursive: true, force: true });
    }
  });
});

async function seedPublished(
  pool: Pool,
  tenantId: string,
  propertyId: string,
  title: string,
  publishedAt: string,
  propertyType: "HOUSE" | "APARTMENT",
  transactionType: "SALE" | "LONG_TERM_RENTAL",
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subtype = propertyType === "APARTMENT" ? "STUDIO" : null;
    const terms = transactionType === "SALE"
      ? ["SALE", "XOF", null, null, 125_000_000, 5_000_000]
      : ["LONG_TERM_RENTAL", "XOF", 350_000, "MONTH", null, 350_000];
    await client.query(`INSERT INTO property_management.properties
      (property_id, tenant_id, title, description, property_type, transaction_type, apartment_subtype,
       status, structural_role, country, city, district, address_line, created_at, updated_at,
       correlation_id, actor_id, published_at, published_by_actor_id, publication_correlation_id,
       usable_surface_square_meters, rooms, bedrooms, bathrooms, furnished,
       commercial_kind, currency, rent_amount_minor, rent_period, sale_price_amount_minor, agency_fee_amount_minor)
      VALUES ($1,$2,$3,'Description publique',$4,$5,$6,'PUBLISHED','STANDALONE','CI','Abidjan','Cocody',
        'Adresse privée',$7,$7,$8,'publisher',$7,'publisher',$8,120,4,3,2,true,$9,$10,$11,$12,$13,$14)`, [
      propertyId, tenantId, title, propertyType, transactionType, subtype, publishedAt, randomUUID(), ...terms,
    ]);
    await client.query(`INSERT INTO property_management.property_photos
      (photo_id, tenant_id, property_id, category, status, is_primary, content_base64, content_type,
       content_byte_size, content_sha256, registered_at, available_at, media_kind, gallery_position)
      VALUES ($1,$2,$3,'BUILDING_EXTERIOR_OR_ENTRANCE','AVAILABLE',true,'iVBORw0KGgo=','image/png',8,
        '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',$4,$4,'IMAGE',0)`,
    [randomUUID(), tenantId, propertyId, publishedAt]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function seedDraft(pool: Pool, tenantId: string, propertyId: string) {
  await pool.query(`INSERT INTO property_management.properties
    (property_id,tenant_id,title,property_type,transaction_type,status,structural_role,country,city,district,address_line,
     created_at,updated_at,correlation_id,actor_id)
    VALUES ($1,$2,'Brouillon','HOUSE','SALE','DRAFT','STANDALONE','CI','Abidjan','Cocody','Adresse privée',now(),now(),$3,'editor')`,
  [propertyId, tenantId, randomUUID()]);
}

async function seedWithdrawn(pool: Pool, tenantId: string, propertyId: string, publishedAt: string) {
  await seedPublished(pool, tenantId, propertyId, "Bien retiré", publishedAt, "HOUSE", "SALE");
  await pool.query(`UPDATE property_management.properties SET status='WITHDRAWN', withdrawn_at=$3,
    withdrawn_by_actor_id='withdrawer', withdrawal_correlation_id=$4, updated_at=$3,
    actor_id='withdrawer', correlation_id=$4
    WHERE tenant_id=$1 AND property_id=$2`, [
    tenantId, propertyId, "2026-08-31T12:30:00.000Z", randomUUID(),
  ]);
}

async function seedLegacyPublished(pool: Pool, tenantId: string, propertyId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO property_management.properties
      (property_id,tenant_id,title,description,property_type,transaction_type,status,structural_role,country,city,district,address_line,
       created_at,updated_at,correlation_id,actor_id,published_at,published_by_actor_id,publication_correlation_id,
       usable_surface_square_meters,rooms,commercial_kind,currency,sale_price_amount_minor)
      VALUES ($1,$2,'Historique','Description historique','HOUSE','SALE','PUBLISHED','STANDALONE','CI','Abidjan','Cocody','Adresse privée',
        now(),now(),$3,'publisher',now(),'publisher',$3,100,4,'SALE','XOF',1000000)`, [propertyId, tenantId, randomUUID()]);
    await client.query(`INSERT INTO property_management.property_photos
      (photo_id,tenant_id,property_id,category,status,url,is_primary,registered_at,available_at)
      VALUES ($1,$2,$3,'OTHER','AVAILABLE','https://example.invalid/legacy.jpg',true,now(),now())`,
    [randomUUID(), tenantId, propertyId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function migrationsThrough(lastIndex: number): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), `monpiole-public-catalog-${lastIndex}-`));
  const meta = join(folder, "meta");
  await mkdir(meta);
  const journal = JSON.parse(await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    version: string;
    dialect: string;
    entries: readonly { idx: number; tag: string }[];
  };
  const entries = journal.entries.filter((entry) => entry.idx <= lastIndex);
  for (const entry of entries) {
    await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
    const prefix = entry.tag.slice(0, 4);
    await copyFile(join(migrationsFolder, "meta", `${prefix}_snapshot.json`), join(meta, `${prefix}_snapshot.json`));
  }
  await writeFile(join(meta, "_journal.json"), JSON.stringify({ ...journal, entries }, null, 2));
  return folder;
}
