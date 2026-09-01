import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, PostgresPropertyOwnerDirectoryQuery,
  PostgresPropertyOwnerRepository, PostgresPropertyPortfolioQuery, PostgresPropertyRepository,
  PropertyNotFoundError, PropertyOwnerNotFoundError, PropertyOwnerTypeChangeNotAllowedError,
  RetrieveProperty, RetrievePropertyOwner, UpdatePropertyCoreInformation, UpdatePropertyDetails, UpdatePropertyOwner, type TransactionType,
  AssignPropertyOwner, PostgresPropertyOwnershipRepository, PropertyOwnershipConflictError,
  PropertyOwnershipShareExceededError, PropertyOwnershipNotFoundError, RemovePropertyOwner, RetrievePropertyOwnerships,
  CreatePropertyBuilding, CreatePropertyUnit, ListPropertyBuildings, ListPropertyUnits, UpdatePropertyBuilding,
  UpdatePropertyUnitStructure, PostgresPropertyCompositionRepository, PropertyBuildingCodeConflictError,
  PropertyUnitCodeConflictError, PropertyStructuralRoleConflictError, Property,
  PersistedPropertyCorruptionError,
  PropertyBuildingNotFoundError, PropertyUnitNotFoundError,
  PublishProperty, PropertyPublicationRequirementsNotMetError, PropertyRepublicationNotSupportedError,
  WithdrawPropertyFromCatalog, PostgresPublicPropertyCatalogQuery,
} from "../src/index.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; const CORRELATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PUBLICATION_CORRELATION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REPLAY_CORRELATION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const WITHDRAWAL_CORRELATION = "11111111-1111-4111-8111-111111111111";
let container: StartedTestContainer; let owner: Pool; let runtime: Pool;
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

function connection(user: string, password: string, database = "property_test") {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/${database}`;
}

beforeAll(async () => {
  container = await new GenericContainer(IMAGE).withEnvironment({ POSTGRES_DB: "property_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner" })
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
afterEach(async () => owner.query("TRUNCATE property_management.property_primary_photo_audits, property_management.property_photo_standards, property_management.property_photos, property_management.property_geolocations, property_management.property_building_units, property_management.property_buildings, property_management.property_ownerships, property_management.properties, property_management.property_owners"));
afterAll(async () => { await runtime?.end(); await owner?.end(); await container?.stop(); });

function authority(tenantId: string) { return { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"] as const, tenantIds: [tenantId] }; }
async function insertLegacyPrimaryPhoto(tenantId: string, propertyId: string) {
  await withTenantPostgresTransaction(runtime, tenantId, (scope) => scope.query(
    `INSERT INTO property_management.property_photos
      (photo_id, tenant_id, property_id, category, status, is_primary, content_base64, content_type,
       content_byte_size, content_sha256, registered_at, available_at)
     VALUES ($1,$2,$3,'BUILDING_EXTERIOR_OR_ENTRANCE','AVAILABLE',true,'iVBORw0KGgo=','image/png',8,
       '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',$4,$4)`,
    [randomUUID(), tenantId, propertyId, "2026-08-25T12:01:00.000Z"],
  ));
}
async function insertStudioPhotoSet(tenantId: string, propertyId: string) {
  await insertLegacyPrimaryPhoto(tenantId, propertyId);
  const categories = [
    "MAIN_LIVING_SLEEPING_AREA", "KITCHEN_OR_KITCHENETTE", "BATHROOM_OR_SHOWER_ROOM", "OTHER", "OTHER",
  ];
  await withTenantPostgresTransaction(runtime, tenantId, async (scope) => {
    for (const category of categories) {
      await scope.query(
        `INSERT INTO property_management.property_photos
          (photo_id, tenant_id, property_id, category, status, is_primary, content_base64, content_type,
           content_byte_size, content_sha256, registered_at, available_at)
         VALUES ($1,$2,$3,$4,'AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
           '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',$5,$5)`,
        [randomUUID(), tenantId, propertyId, category, "2026-08-25T12:01:00.000Z"],
      );
    }
  });
}
async function create(repository = new PostgresPropertyRepository(runtime), tenantId = TENANT_A, transactionType: TransactionType = "SALE", propertyId = PROPERTY_ID) {
  const created = await new CreateProperty(repository, { generate: () => propertyId }, { now: () => "2026-08-25T12:00:00.000Z" }).execute({
    authority: authority(tenantId), correlationId: CORRELATION, title: "House", propertyType: "HOUSE", transactionType,
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
  await insertLegacyPrimaryPhoto(tenantId, propertyId);
  return created;
}

describe("Property PostgreSQL persistence", () => {
  it("migre 0012 vers 0013 sans altérer les DRAFT/PUBLISHED historiques", async () => {
    const previousMigrations = await migrationsThrough(12);
    await owner.query("CREATE DATABASE property_withdrawal_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_withdrawal_upgrade_test") });
    const publishedId = "22222222-2222-4222-8222-222222222222";
    try {
      await migrate(drizzle(upgrade), { migrationsFolder: previousMigrations });
      for (const [propertyId, title] of [[PROPERTY_ID, "Historical draft"], [publishedId, "Historical published"]]) {
        await upgrade.query(`INSERT INTO property_management.properties
          (property_id, tenant_id, title, property_type, transaction_type, status, country, city, district, address_line,
           rooms, commercial_kind, currency, sale_price_amount_minor, photo_standard_version,
           created_at, updated_at, correlation_id, actor_id)
          VALUES ($1,$2,$3,'HOUSE','SALE','DRAFT','CI','Abidjan','Cocody','Riviera',1,'SALE','XOF',1,1,now(),now(),$4,'historical')`,
        [propertyId, TENANT_A, title, CORRELATION]);
      }
      await upgrade.query(`INSERT INTO property_management.property_photos
        (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,content_byte_size,content_sha256,registered_at,available_at)
        VALUES ($1,$2,$3,'BUILDING_EXTERIOR_OR_ENTRANCE','AVAILABLE',true,'iVBORw0KGgo=','image/png',8,
          '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now())`,
      [randomUUID(), TENANT_A, publishedId]);
      await upgrade.query(`UPDATE property_management.properties SET status='PUBLISHED', published_at=now(),
        published_by_actor_id='historical-publisher', publication_correlation_id=$2 WHERE property_id=$1`,
      [publishedId, PUBLICATION_CORRELATION]);

      await migrate(drizzle(upgrade), { migrationsFolder });

      expect((await upgrade.query(`SELECT property_id, status, withdrawn_at, withdrawn_by_actor_id, withdrawal_correlation_id
        FROM property_management.properties ORDER BY property_id`)).rows).toEqual([
        { property_id: publishedId, status: "PUBLISHED", withdrawn_at: null, withdrawn_by_actor_id: null, withdrawal_correlation_id: null },
        { property_id: PROPERTY_ID, status: "DRAFT", withdrawn_at: null, withdrawn_by_actor_id: null, withdrawal_correlation_id: null },
      ]);
      expect((await upgrade.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE connamespace='property_management'::regnamespace AND conname='properties_status_check'`)).rows[0]?.definition)
        .toContain("'WITHDRAWN'::text");
      expect((await upgrade.query(`SELECT has_column_privilege('monpiole_public_catalog_reader',
        'property_management.properties', 'withdrawn_at', 'SELECT') AS public_can_read_withdrawal_trace`)).rows[0])
        .toEqual({ public_can_read_withdrawal_trace: false });
    } finally {
      await upgrade.end();
      await rm(previousMigrations, { recursive: true, force: true });
    }
  });
  it("migre 0006 vers 0007, ferme CG-01 et préserve les Properties DRAFT historiques", async () => {
    const previousMigrations = await previousPropertyMigrations();
    await owner.query("CREATE DATABASE property_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_upgrade_test") });
    try {
      await migrate(drizzle(upgrade), { migrationsFolder: previousMigrations });
      await upgrade.query(`INSERT INTO property_management.properties
        (property_id, tenant_id, title, property_type, transaction_type, status, country, city, district, address_line, created_at, updated_at, correlation_id, actor_id)
        VALUES ($1,$2,'Historical house','HOUSE','SALE','DRAFT','CI','Abidjan','Cocody','Riviera',now(),now(),$3,'migration-test')`, [PROPERTY_ID, TENANT_A, CORRELATION]);

      await migrate(drizzle(upgrade), { migrationsFolder });

      expect((await upgrade.query(`SELECT title, structural_role, published_at, published_by_actor_id, publication_correlation_id
        FROM property_management.properties WHERE property_id = $1`, [PROPERTY_ID])).rows[0])
        .toEqual({ title: "Historical house", structural_role: "STANDALONE", published_at: null,
          published_by_actor_id: null, publication_correlation_id: null });
      const constraints = (await upgrade.query(`SELECT conname FROM pg_constraint
        WHERE connamespace = 'property_management'::regnamespace ORDER BY conname`)).rows.map((row) => row.conname);
      expect(constraints).toEqual(expect.arrayContaining([
        "properties_title_length_check", "properties_description_length_check", "properties_type_check",
        "properties_transaction_type_check", "properties_status_check", "properties_country_check",
        "properties_details_values_check", "properties_commercial_terms_check", "properties_structural_role_check",
        "properties_publication_state_check", "property_owners_identity_check", "property_owners_contact_check",
        "property_ownerships_share_check", "property_buildings_code_check", "property_buildings_name_check",
        "property_building_units_code_check", "property_buildings_property_tenant_fk",
        "property_buildings_tenant_property_code_unique", "property_building_units_building_tenant_fk",
        "property_building_units_property_tenant_fk", "property_building_units_tenant_unit_unique",
        "property_building_units_tenant_building_code_unique",
      ]));
      const indexes = (await upgrade.query(`SELECT indexname FROM pg_indexes
        WHERE schemaname = 'property_management' ORDER BY indexname`)).rows.map((row) => row.indexname);
      expect(indexes).toEqual(expect.arrayContaining([
        "property_buildings_tenant_property_code_idx", "property_building_units_tenant_building_code_idx",
        "properties_tenant_status_created_property_idx",
      ]));
      expect((await upgrade.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relnamespace = 'property_management'::regnamespace
          AND relname IN ('properties','property_buildings','property_building_units','property_owners','property_ownerships')
        ORDER BY relname`)).rows)
        .toEqual([
          { relname: "properties", relrowsecurity: true, relforcerowsecurity: true },
          { relname: "property_building_units", relrowsecurity: true, relforcerowsecurity: true },
          { relname: "property_buildings", relrowsecurity: true, relforcerowsecurity: true },
          { relname: "property_owners", relrowsecurity: true, relforcerowsecurity: true },
          { relname: "property_ownerships", relrowsecurity: true, relforcerowsecurity: true },
        ]);
      expect((await upgrade.query(`SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'property_management'
          AND tablename IN ('properties','property_buildings','property_building_units','property_owners','property_ownerships')
        ORDER BY tablename`)).rows)
        .toEqual([
          { tablename: "properties", policyname: "properties_public_catalog_published_select" },
          { tablename: "properties", policyname: "properties_tenant_isolation" },
          { tablename: "property_building_units", policyname: "property_building_units_tenant_isolation" },
          { tablename: "property_buildings", policyname: "property_buildings_tenant_isolation" },
          { tablename: "property_owners", policyname: "property_owners_tenant_isolation" },
          { tablename: "property_ownerships", policyname: "property_ownerships_tenant_isolation" },
        ]);
    } finally {
      await upgrade.end();
      await rm(previousMigrations, { recursive: true, force: true });
    }
  });

  it("persists and rehydrates through a fresh repository", async () => {
    await create();
    const found = await new RetrieveProperty(new PostgresPropertyRepository(runtime)).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID });
    expect(found).toMatchObject({ propertyId: PROPERTY_ID, tenantId: TENANT_A, status: "DRAFT", title: "House" });
    expect((await owner.query("SELECT tenant_id, status FROM property_management.properties")).rows[0]).toEqual({ tenant_id: TENANT_A, status: "DRAFT" });
  });
  it("returns not found for unknown and cross-tenant lookups", async () => {
    await create(); const retrieve = new RetrieveProperty(new PostgresPropertyRepository(runtime));
    await expect(retrieve.execute({ authority: authority(TENANT_B), propertyId: PROPERTY_ID })).rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(retrieve.execute({ authority: authority(TENANT_A), propertyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
  it("atomically persists core information and trace without changing immutable fields", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 4 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 50_000_000 },
    });
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    await update.execute({ authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, title: "Villa Lagune", description: "Rénovée",
      location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" } });
    await expect(new RetrieveProperty(new PostgresPropertyRepository(runtime)).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ title: "Villa Lagune", description: "Rénovée", propertyType: "HOUSE", transactionType: "SALE",
        status: "DRAFT", location: { district: "Marcory", addressLine: "Zone 4" }, details: { rooms: 4 },
        commercialTerms: { kind: "SALE", salePriceAmountMinor: 50_000_000 }, updatedAt: "2026-08-25T15:00:00.000Z" });
    expect((await owner.query("SELECT correlation_id, actor_id FROM property_management.properties")).rows[0])
      .toEqual({ correlation_id: CORRELATION, actor_id: "actor" });
  });
  it("does not update core information across tenants", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    await expect(update.execute({ authority: { ...authority(TENANT_B), grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, title: "Invisible", location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" } }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    expect((await owner.query("SELECT title FROM property_management.properties")).rows[0]?.title).toBe("House");
  });
  it("forces RLS outside a tenant transaction", async () => {
    expect((await runtime.query("SELECT * FROM property_management.properties")).rows).toHaveLength(0);
    await expect(runtime.query(`INSERT INTO property_management.properties
      (property_id, tenant_id, title, property_type, transaction_type, status, country, city, district, address_line, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'House','HOUSE','SALE','DRAFT','CI','Abidjan','Cocody','Riviera',now(),now(),$3,'actor')`, [PROPERTY_ID, TENANT_A, CORRELATION]))
      .rejects.toMatchObject({ code: "42501" });
  });
  it.each([
    ["LONG_TERM_RENTAL", { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH", securityDepositAmountMinor: 500_000 }],
    ["SHORT_TERM_RENTAL", { kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45_000, pricingUnit: "NIGHT" }],
    ["SALE", { kind: "SALE", currency: "XOF", salePriceAmountMinor: 80_000_000 }],
  ] as const)("atomically persists and reconstructs %s terms", async (transactionType, commercialTerms) => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository, TENANT_A, transactionType);
    const update = new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    await update.execute({ authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { usableSurfaceSquareMeters: 90, rooms: 4, bedrooms: 2, bathrooms: 1 }, commercialTerms });
    await expect(new RetrieveProperty(new PostgresPropertyRepository(runtime)).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ details: { rooms: 4 }, commercialTerms, updatedAt: "2026-08-25T14:00:00.000Z" });
  });
  it("publishes once, persists dedicated first-publication traces and preserves them on replay and later mutation", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 0 },
      commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 0 },
    });
    const publish = new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    const command = { authority: { ...authority(TENANT_A), actorId: "publisher", grants: ["PUBLISH_PROPERTY"] as const },
      correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID };
    await expect(publish.execute(command)).resolves.toMatchObject({
      outcome: "PUBLISHED", property: { status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z", updatedAt: "2026-08-25T14:00:00.000Z" },
    });
    await expect(new PublishProperty(repository, { now: () => { throw new Error("clock must not be read on replay"); } }).execute({
      ...command, authority: { ...command.authority, actorId: "replayer" }, correlationId: REPLAY_CORRELATION,
    })).resolves.toMatchObject({ outcome: "ALREADY_PUBLISHED", property: { publishedAt: "2026-08-25T14:00:00.000Z" } });

    const rowAfterReplay = (await owner.query(`SELECT status, published_at, published_by_actor_id, publication_correlation_id,
      updated_at, actor_id, correlation_id FROM property_management.properties`)).rows[0];
    expect({ ...rowAfterReplay, published_at: rowAfterReplay.published_at.toISOString(), updated_at: rowAfterReplay.updated_at.toISOString() }).toEqual({
      status: "PUBLISHED", published_at: "2026-08-25T14:00:00.000Z", published_by_actor_id: "publisher",
      publication_correlation_id: PUBLICATION_CORRELATION, updated_at: "2026-08-25T14:00:00.000Z",
      actor_id: "publisher", correlation_id: PUBLICATION_CORRELATION,
    });
    const page = await new ListProperties(new PostgresPropertyPortfolioQuery(runtime)).execute({
      authority: { ...authority(TENANT_A), grants: ["LIST_PROPERTIES"] }, status: "PUBLISHED",
    });
    expect(page.items).toEqual([expect.objectContaining({ propertyId: PROPERTY_ID, status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z" })]);

    await new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), actorId: "editor", grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] },
      correlationId: REPLAY_CORRELATION, propertyId: PROPERTY_ID, title: "Maison publiée",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    });
    expect((await owner.query(`SELECT status, published_by_actor_id, publication_correlation_id, actor_id, correlation_id
      FROM property_management.properties`)).rows[0]).toEqual({
      status: "PUBLISHED", published_by_actor_id: "publisher", publication_correlation_id: PUBLICATION_CORRELATION,
      actor_id: "editor", correlation_id: REPLAY_CORRELATION,
    });
  });
  it("withdraws exactly once, serializes concurrent calls and removes every public read while preserving private data", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 3 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 42 },
    });
    await new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), actorId: "publisher", grants: ["PUBLISH_PROPERTY"] },
      correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID,
    });
    await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
      `INSERT INTO property_management.property_geolocations
        (tenant_id, property_id, latitude, longitude, public_visibility, updated_at, correlation_id, actor_id)
       VALUES ($1,$2,5.359952,-4.008256,'HIDDEN',$3,$4,'geolocation-editor')`,
      [TENANT_A, PROPERTY_ID, "2026-08-25T14:30:00.000Z", CORRELATION],
    ));
    const publicPool = new Pool({ connectionString: connection("monpiole_public_catalog_reader", "synthetic-public-reader") });
    try {
      const catalog = new PostgresPublicPropertyCatalogQuery(publicPool);
      expect((await catalog.list({ tenantId: TENANT_A, limit: 20 })).items).toEqual([
        expect.objectContaining({ publicPropertyId: PROPERTY_ID }),
      ]);
      await expect(catalog.retrieve(TENANT_A, PROPERTY_ID)).resolves.toMatchObject({ publicPropertyId: PROPERTY_ID });
      await expect(catalog.retrievePrimaryPhoto(TENANT_A, PROPERTY_ID)).resolves.toMatchObject({ contentType: "image/png" });

      const attempts = [
        { instant: "2026-08-25T15:00:00.000Z", actorId: "withdrawer-a", correlationId: WITHDRAWAL_CORRELATION },
        { instant: "2026-08-25T15:00:01.000Z", actorId: "withdrawer-b", correlationId: REPLAY_CORRELATION },
      ];
      const results = await Promise.all(attempts.map((attempt) => new WithdrawPropertyFromCatalog(repository, { now: () => attempt.instant }).execute({
        authority: { ...authority(TENANT_A), actorId: attempt.actorId, grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] },
        correlationId: attempt.correlationId, propertyId: PROPERTY_ID,
      })));
      expect(results.map((result) => result.outcome).sort()).toEqual(["ALREADY_WITHDRAWN", "WITHDRAWN"]);
      const row = (await owner.query(`SELECT status, published_at, published_by_actor_id, publication_correlation_id,
        withdrawn_at, withdrawn_by_actor_id, withdrawal_correlation_id, updated_at, actor_id, correlation_id
        FROM property_management.properties WHERE property_id=$1`, [PROPERTY_ID])).rows[0];
      const winner = attempts.find((attempt) => attempt.instant === row.withdrawn_at.toISOString());
      expect(winner).toBeDefined();
      expect({ ...row, published_at: row.published_at.toISOString(), withdrawn_at: row.withdrawn_at.toISOString(), updated_at: row.updated_at.toISOString() })
        .toMatchObject({
          status: "WITHDRAWN", published_at: "2026-08-25T14:00:00.000Z", published_by_actor_id: "publisher",
          publication_correlation_id: PUBLICATION_CORRELATION, withdrawn_by_actor_id: winner?.actorId,
          withdrawal_correlation_id: winner?.correlationId, actor_id: winner?.actorId, correlation_id: winner?.correlationId,
        });
      await expect(new WithdrawPropertyFromCatalog(repository, { now: () => { throw new Error("clock must not be read on replay"); } }).execute({
        authority: { ...authority(TENANT_A), actorId: "replayer", grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] },
        correlationId: CORRELATION, propertyId: PROPERTY_ID,
      })).resolves.toMatchObject({ outcome: "ALREADY_WITHDRAWN" });
      await expect(new WithdrawPropertyFromCatalog(repository, { now: () => "2026-08-25T16:00:00.000Z" }).execute({
        authority: { ...authority(TENANT_B), grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] },
        correlationId: CORRELATION, propertyId: PROPERTY_ID,
      })).rejects.toBeInstanceOf(PropertyNotFoundError);
      const crossTenantRead = await withTenantPostgresTransaction(runtime, TENANT_B, (scope) => scope.query(
        "SELECT property_id FROM property_management.properties WHERE property_id=$1",
        [PROPERTY_ID],
      ));
      expect(crossTenantRead).toEqual([]);
      const crossTenantWrite = await withTenantPostgresTransaction(runtime, TENANT_B, (scope) => scope.query(
        "UPDATE property_management.properties SET title='forbidden' WHERE property_id=$1 RETURNING property_id",
        [PROPERTY_ID],
      ));
      expect(crossTenantWrite).toEqual([]);

      await expect(new RetrieveProperty(repository).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID }))
        .resolves.toMatchObject({ status: "WITHDRAWN", title: "House", details: { rooms: 3 }, commercialTerms: { salePriceAmountMinor: 42 } });
      const privatePage = await new ListProperties(new PostgresPropertyPortfolioQuery(runtime)).execute({
        authority: { ...authority(TENANT_A), grants: ["LIST_PROPERTIES"] }, status: "WITHDRAWN",
      });
      expect(privatePage.items).toEqual([expect.objectContaining({
        propertyId: PROPERTY_ID, status: "WITHDRAWN", publishedAt: "2026-08-25T14:00:00.000Z", withdrawnAt: winner?.instant,
      })]);
      expect((await catalog.list({ tenantId: TENANT_A, limit: 20 })).items).toEqual([]);
      await expect(catalog.retrieve(TENANT_A, PROPERTY_ID)).resolves.toBeUndefined();
      await expect(catalog.retrievePrimaryPhoto(TENANT_A, PROPERTY_ID)).resolves.toBeUndefined();

      await new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T16:00:00.000Z" }).execute({
        authority: { ...authority(TENANT_A), actorId: "editor", grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] },
        correlationId: CORRELATION, propertyId: PROPERTY_ID, title: "Maison privée conservée",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
      });
      expect((await owner.query(`SELECT status, withdrawn_by_actor_id, withdrawal_correlation_id, actor_id
        FROM property_management.properties WHERE property_id=$1`, [PROPERTY_ID])).rows[0]).toEqual({
        status: "WITHDRAWN", withdrawn_by_actor_id: winner?.actorId,
        withdrawal_correlation_id: winner?.correlationId, actor_id: "editor",
      });
      expect(await withTenantPostgresTransaction(runtime, TENANT_A, (scope) => scope.query(
        `SELECT latitude::text, longitude::text, public_visibility, actor_id
         FROM property_management.property_geolocations WHERE property_id=$1`,
        [PROPERTY_ID],
      ))).toEqual([{
        latitude: "5.359952", longitude: "-4.008256", public_visibility: "HIDDEN", actor_id: "geolocation-editor",
      }]);
    } finally {
      await publicPool.end();
    }
  });
  it("rejects publication without prerequisites and hides another tenant", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    const publish = new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    const command = { authority: { ...authority(TENANT_A), grants: ["PUBLISH_PROPERTY"] as const },
      correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID };
    await expect(publish.execute(command)).rejects.toBeInstanceOf(PropertyPublicationRequirementsNotMetError);
    await expect(publish.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
    expect((await owner.query("SELECT status, published_at FROM property_management.properties")).rows[0])
      .toEqual({ status: "DRAFT", published_at: null });
  });
  it("serializes concurrent publication calls into one durable transition and two successful results", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
    });
    const attempts = [
      { instant: "2026-08-25T14:00:00.000Z", actorId: "publisher-a", correlationId: PUBLICATION_CORRELATION },
      { instant: "2026-08-25T14:00:01.000Z", actorId: "publisher-b", correlationId: REPLAY_CORRELATION },
    ];
    const results = await Promise.all(attempts.map((attempt) => new PublishProperty(repository, { now: () => attempt.instant }).execute({
      authority: { ...authority(TENANT_A), actorId: attempt.actorId, grants: ["PUBLISH_PROPERTY"] },
      correlationId: attempt.correlationId, propertyId: PROPERTY_ID,
    })));
    expect(results.map((result) => result.outcome).sort()).toEqual(["ALREADY_PUBLISHED", "PUBLISHED"]);
    const row = (await owner.query(`SELECT status, published_at, published_by_actor_id, publication_correlation_id
      FROM property_management.properties`)).rows[0];
    const winningAttempt = attempts.find((attempt) => attempt.instant === row.published_at.toISOString());
    expect(winningAttempt).toBeDefined();
    expect(row).toMatchObject({ status: "PUBLISHED", published_by_actor_id: winningAttempt?.actorId,
      publication_correlation_id: winningAttempt?.correlationId });
  });
  it("serializes a publication replay racing with withdrawal into a valid terminal state", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
    });
    await new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["PUBLISH_PROPERTY"] },
      correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID,
    });
    const [publication, withdrawal] = await Promise.allSettled([
      new PublishProperty(repository, { now: () => "2026-08-25T15:00:00.000Z" }).execute({
        authority: { ...authority(TENANT_A), actorId: "publisher-replay", grants: ["PUBLISH_PROPERTY"] },
        correlationId: REPLAY_CORRELATION, propertyId: PROPERTY_ID,
      }),
      new WithdrawPropertyFromCatalog(repository, { now: () => "2026-08-25T15:00:00.000Z" }).execute({
        authority: { ...authority(TENANT_A), actorId: "withdrawer", grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] },
        correlationId: WITHDRAWAL_CORRELATION, propertyId: PROPERTY_ID,
      }),
    ]);
    expect(withdrawal).toMatchObject({ status: "fulfilled", value: { outcome: "WITHDRAWN" } });
    if (publication.status === "fulfilled") expect(publication.value.outcome).toBe("ALREADY_PUBLISHED");
    else expect(publication.reason).toBeInstanceOf(PropertyRepublicationNotSupportedError);
    await expect(new RetrieveProperty(repository).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ status: "WITHDRAWN", publishedAt: "2026-08-25T14:00:00.000Z", withdrawnAt: "2026-08-25T15:00:00.000Z" });
  });
  it("serializes publication with a concurrent details update while preserving both outcomes", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    const detailsAuthority = { ...authority(TENANT_A), actorId: "editor", grants: ["UPDATE_PROPERTY_DETAILS"] as const };
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: detailsAuthority, correlationId: CORRELATION, propertyId: PROPERTY_ID,
      details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
    });
    const results = await Promise.all([
      new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
        authority: { ...authority(TENANT_A), actorId: "publisher", grants: ["PUBLISH_PROPERTY"] },
        correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID,
      }),
      new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
        authority: detailsAuthority, correlationId: REPLAY_CORRELATION, propertyId: PROPERTY_ID,
        details: { rooms: 2 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 2 },
      }),
    ]);
    expect(results[0]).toMatchObject({ outcome: "PUBLISHED", property: { status: "PUBLISHED" } });
    const persisted = await new RetrieveProperty(repository).execute({ authority: authority(TENANT_A), propertyId: PROPERTY_ID });
    expect(persisted).toMatchObject({ status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z",
      details: { rooms: 2 }, commercialTerms: { kind: "SALE", salePriceAmountMinor: 2 } });
    expect((await owner.query(`SELECT published_by_actor_id, publication_correlation_id
      FROM property_management.properties`)).rows[0]).toEqual({
      published_by_actor_id: "publisher", publication_correlation_id: PUBLICATION_CORRELATION,
    });
  });
  it("enforces the publication-state and status checks at the database boundary", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
    });
    await expect(owner.query("UPDATE property_management.properties SET status='PUBLISHED' WHERE property_id=$1", [PROPERTY_ID]))
      .rejects.toMatchObject({ code: "23514", constraint: "properties_publication_state_check" });
    await expect(owner.query("UPDATE property_management.properties SET status='ARCHIVED' WHERE property_id=$1", [PROPERTY_ID]))
      .rejects.toMatchObject({ code: "23514" });
    await expect(owner.query(`UPDATE property_management.properties
      SET withdrawn_at=now(), withdrawn_by_actor_id='invalid', withdrawal_correlation_id=$2
      WHERE property_id=$1`, [PROPERTY_ID, WITHDRAWAL_CORRELATION]))
      .rejects.toMatchObject({ code: "23514", constraint: "properties_publication_state_check" });
    await new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" }).execute({
      authority: { ...authority(TENANT_A), grants: ["PUBLISH_PROPERTY"] },
      correlationId: PUBLICATION_CORRELATION, propertyId: PROPERTY_ID,
    });
    await expect(owner.query("UPDATE property_management.properties SET status='WITHDRAWN' WHERE property_id=$1", [PROPERTY_ID]))
      .rejects.toMatchObject({ code: "23514", constraint: "properties_publication_state_check" });
    await expect(owner.query(`UPDATE property_management.properties SET status='WITHDRAWN',
      withdrawn_at=published_at - interval '1 second', withdrawn_by_actor_id='invalid', withdrawal_correlation_id=$2
      WHERE property_id=$1`, [PROPERTY_ID, WITHDRAWAL_CORRELATION]))
      .rejects.toMatchObject({ code: "23514", constraint: "properties_publication_state_check" });
    expect((await owner.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE connamespace='property_management'::regnamespace AND conname='properties_status_check'`)).rows[0]?.definition)
      .toContain("status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'WITHDRAWN'::text])");
  });
  it("does not update another tenant's Property", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository);
    const update = new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    await expect(update.execute({ authority: { ...authority(TENANT_B), grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 2 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 } }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    expect((await owner.query("SELECT commercial_kind FROM property_management.properties")).rows[0]?.commercial_kind).toBeNull();
  });
  it("replaces existing terms atomically and rolls back an incompatible update", async () => {
    const repository = new PostgresPropertyRepository(runtime); await create(repository, TENANT_A, "LONG_TERM_RENTAL");
    const update = new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    const command = { authority: { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] as const }, correlationId: CORRELATION,
      propertyId: PROPERTY_ID, details: { rooms: 3 }, commercialTerms: { kind: "LONG_TERM_RENTAL" as const, currency: "XOF", rentAmountMinor: 100, rentPeriod: "MONTH" as const } };
    await update.execute(command);
    await update.execute({ ...command, commercialTerms: { ...command.commercialTerms, rentAmountMinor: 200 } });
    await expect(update.execute({ ...command, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 } }))
      .rejects.toBeDefined();
    expect((await owner.query("SELECT rent_amount_minor, commercial_kind FROM property_management.properties")).rows[0])
      .toEqual({ rent_amount_minor: "200", commercial_kind: "LONG_TERM_RENTAL" });
  });

  it("lists a stable tenant-scoped portfolio with filter, search and cursor pagination", async () => {
    const repository = new PostgresPropertyRepository(runtime);
    const fixtures = [
      { tenantId: TENANT_A, propertyId: "11111111-1111-4111-8111-111111111111", title: "Maison Lagune Ouest", propertyType: "HOUSE" as const, createdAt: "2026-08-25T13:00:00.000Z" },
      { tenantId: TENANT_A, propertyId: "22222222-2222-4222-8222-222222222222", title: "Maison Lagune Est", propertyType: "HOUSE" as const, createdAt: "2026-08-25T13:00:00.000Z" },
      { tenantId: TENANT_A, propertyId: "33333333-3333-4333-8333-333333333333", title: "Terrain Lagune", propertyType: "LAND" as const, createdAt: "2026-08-25T14:00:00.000Z" },
      { tenantId: TENANT_B, propertyId: "44444444-4444-4444-8444-444444444444", title: "Maison Lagune autre tenant", propertyType: "HOUSE" as const, createdAt: "2026-08-25T15:00:00.000Z" },
    ];
    for (const fixture of fixtures) await new CreateProperty(
      repository, { generate: () => fixture.propertyId }, { now: () => fixture.createdAt },
    ).execute({
      authority: authority(fixture.tenantId), correlationId: CORRELATION, title: fixture.title,
      propertyType: fixture.propertyType, transactionType: "SALE",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Bord de lagune" },
    });

    const list = new ListProperties(new PostgresPropertyPortfolioQuery(runtime));
    const listAuthority = { ...authority(TENANT_A), grants: ["LIST_PROPERTIES"] as const };
    const first = await list.execute({
      authority: listAuthority, status: "DRAFT", propertyType: "HOUSE", search: "lagune", limit: 1,
    });
    expect(first.items.map((value) => value.propertyId)).toEqual(["22222222-2222-4222-8222-222222222222"]);
    expect(first.nextCursor).toEqual({ createdAt: "2026-08-25T13:00:00.000Z", propertyId: "22222222-2222-4222-8222-222222222222" });
    const second = await list.execute({
      authority: listAuthority, status: "DRAFT", propertyType: "HOUSE", search: "lagune", limit: 1,
      cursor: first.nextCursor,
    });
    expect(second.items.map((value) => value.propertyId)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(second.nextCursor).toBeUndefined();
    expect([...first.items, ...second.items]).toHaveLength(2);
    expect((await owner.query("SELECT indexdef FROM pg_indexes WHERE schemaname = 'property_management' AND indexname = 'properties_tenant_created_property_idx'")).rows[0]?.indexdef)
      .toContain("tenant_id, created_at DESC NULLS LAST, property_id DESC NULLS LAST");
  });
});

async function previousPropertyMigrations() {
  const folder = await mkdtemp(join(tmpdir(), "monpiole-property-0006-"));
  const meta = join(folder, "meta");
  await mkdir(meta);
  for (let index = 0; index <= 6; index += 1) {
    const prefix = String(index).padStart(4, "0");
    const migrationName = index === 6 ? `${prefix}_property_composition.sql` : `${prefix}_property_management_baseline.sql`;
    await copyFile(join(migrationsFolder, migrationName), join(folder, migrationName));
    await copyFile(join(migrationsFolder, "meta", `${prefix}_snapshot.json`), join(meta, `${prefix}_snapshot.json`));
  }
  const journal = JSON.parse(await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    readonly version: string;
    readonly dialect: string;
    readonly entries: readonly { readonly idx: number }[];
  };
  await writeFile(join(meta, "_journal.json"), `${JSON.stringify({ ...journal, entries: journal.entries.filter((entry) => entry.idx <= 6) }, null, 2)}\n`, "utf8");
  return folder;
}

async function migrationsThrough(lastIndex: number) {
  const folder = await mkdtemp(join(tmpdir(), `monpiole-property-${lastIndex}-`));
  const meta = join(folder, "meta");
  await mkdir(meta);
  const journal = JSON.parse(await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    readonly version: string; readonly dialect: string;
    readonly entries: readonly { readonly idx: number; readonly tag: string }[];
  };
  const entries = journal.entries.filter((entry) => entry.idx <= lastIndex);
  for (const entry of entries) {
    await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
    const prefix = String(entry.idx).padStart(4, "0");
    await copyFile(join(migrationsFolder, "meta", `${prefix}_snapshot.json`), join(meta, `${prefix}_snapshot.json`));
  }
  await writeFile(join(meta, "_journal.json"), `${JSON.stringify({ ...journal, entries }, null, 2)}\n`, "utf8");
  return folder;
}

function ownerAuthority(tenantId: string) {
  return { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "UPDATE_PROPERTY_OWNER"] as const, tenantIds: [tenantId] };
}
function createOwner(repository = new PostgresPropertyOwnerRepository(runtime), tenantId = TENANT_A, ownerType: "INDIVIDUAL" | "LEGAL_ENTITY" = "INDIVIDUAL", ownerId = PROPERTY_ID) {
  return new CreatePropertyOwner(repository, { generate: () => ownerId }, { now: () => "2026-08-26T10:00:00.000Z" }).execute({
    authority: ownerAuthority(tenantId), correlationId: CORRELATION,
    identity: ownerType === "INDIVIDUAL"
      ? { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" }
      : { ownerType: "LEGAL_ENTITY", legalName: "Immobilière Plateau SA", registrationNumber: "CI-ABJ-2026-B-00000" },
    contactInformation: { phoneNumber: "+2250700000000", email: "contact@example.com" },
  });
}

describe("PropertyOwner PostgreSQL persistence", () => {
  it.each(["INDIVIDUAL", "LEGAL_ENTITY"] as const)("persists and reconstructs %s", async (ownerType) => {
    await createOwner(undefined, TENANT_A, ownerType);
    const found = await new RetrievePropertyOwner(new PostgresPropertyOwnerRepository(runtime)).execute({
      authority: ownerAuthority(TENANT_A), ownerId: PROPERTY_ID,
    });
    expect(found).toMatchObject({ ownerId: PROPERTY_ID, tenantId: TENANT_A, identity: { ownerType }, contactInformation: { email: "contact@example.com" } });
  });

  it("lists, searches and paginates owners without leaking another tenant", async () => {
    const repository = new PostgresPropertyOwnerRepository(runtime);
    const fixtures = [
      { tenantId: TENANT_A, ownerId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-08-26T13:00:00.000Z", identity: { ownerType: "INDIVIDUAL" as const, firstName: "Awa", lastName: "Kouassi" } },
      { tenantId: TENANT_A, ownerId: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-26T13:00:00.000Z", identity: { ownerType: "LEGAL_ENTITY" as const, legalName: "Kouassi Immobilier", registrationNumber: "CI-ABJ-42" } },
      { tenantId: TENANT_A, ownerId: "33333333-3333-4333-8333-333333333333", createdAt: "2026-08-26T14:00:00.000Z", identity: { ownerType: "INDIVIDUAL" as const, firstName: "Fatou", lastName: "Diop" } },
      { tenantId: TENANT_B, ownerId: "44444444-4444-4444-8444-444444444444", createdAt: "2026-08-26T15:00:00.000Z", identity: { ownerType: "INDIVIDUAL" as const, firstName: "Awa", lastName: "Kouassi" } },
    ];
    for (const fixture of fixtures) await new CreatePropertyOwner(
      repository, { generate: () => fixture.ownerId }, { now: () => fixture.createdAt },
    ).execute({ authority: ownerAuthority(fixture.tenantId), correlationId: CORRELATION, identity: fixture.identity, contactInformation: {} });

    const list = new ListPropertyOwners(new PostgresPropertyOwnerDirectoryQuery(runtime));
    const listAuthority = { ...ownerAuthority(TENANT_A), grants: ["LIST_PROPERTY_OWNERS"] as const };
    const first = await list.execute({ authority: listAuthority, search: "Kouassi", limit: 1 });
    expect(first.items.map((value) => value.ownerId)).toEqual(["22222222-2222-4222-8222-222222222222"]);
    expect(first.nextCursor).toEqual({ createdAt: "2026-08-26T13:00:00.000Z", ownerId: "22222222-2222-4222-8222-222222222222" });
    const second = await list.execute({ authority: listAuthority, search: "Kouassi", limit: 1, cursor: first.nextCursor });
    expect(second.items.map((value) => value.ownerId)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(second.nextCursor).toBeUndefined();
    expect((await owner.query("SELECT indexdef FROM pg_indexes WHERE schemaname = 'property_management' AND indexname = 'property_owners_tenant_created_owner_idx'")).rows[0]?.indexdef)
      .toContain("tenant_id, created_at DESC NULLS LAST, owner_id DESC NULLS LAST");
  });

  it("updates an owner atomically while preserving its identifiers and type", async () => {
    const repository = new PostgresPropertyOwnerRepository(runtime); await createOwner(repository);
    const update = new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" });
    const updated = await update.execute({ authority: ownerAuthority(TENANT_A), correlationId: CORRELATION, ownerId: PROPERTY_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jeannot", lastName: "Kouassi" }, contactInformation: { email: "new@example.com" } });
    expect(updated).toMatchObject({ ownerId: PROPERTY_ID, tenantId: TENANT_A, identity: { ownerType: "INDIVIDUAL", firstName: "Jeannot" }, updatedAt: "2026-08-26T11:00:00.000Z" });
    expect((await owner.query("SELECT owner_type, first_name, email FROM property_management.property_owners")).rows[0])
      .toEqual({ owner_type: "INDIVIDUAL", first_name: "Jeannot", email: "new@example.com" });
  });

  it("rolls back a forbidden type change", async () => {
    const repository = new PostgresPropertyOwnerRepository(runtime); await createOwner(repository);
    await expect(new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" }).execute({
      authority: ownerAuthority(TENANT_A), correlationId: CORRELATION, ownerId: PROPERTY_ID,
      identity: { ownerType: "LEGAL_ENTITY", legalName: "Changed" }, contactInformation: {},
    })).rejects.toBeInstanceOf(PropertyOwnerTypeChangeNotAllowedError);
    expect((await owner.query("SELECT owner_type, first_name FROM property_management.property_owners")).rows[0])
      .toEqual({ owner_type: "INDIVIDUAL", first_name: "Jean" });
  });

  it("returns not found for missing and cross-tenant access without mutation", async () => {
    const repository = new PostgresPropertyOwnerRepository(runtime); await createOwner(repository);
    const retrieve = new RetrievePropertyOwner(repository);
    await expect(retrieve.execute({ authority: ownerAuthority(TENANT_B), ownerId: PROPERTY_ID })).rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
    await expect(new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" }).execute({
      authority: ownerAuthority(TENANT_B), correlationId: CORRELATION, ownerId: PROPERTY_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Other", lastName: "Tenant" }, contactInformation: {},
    })).rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
    expect((await owner.query("SELECT first_name FROM property_management.property_owners")).rows[0]?.first_name).toBe("Jean");
  });

  it("forces owner RLS outside a tenant transaction", async () => {
    await createOwner();
    expect((await runtime.query("SELECT * FROM property_management.property_owners")).rows).toHaveLength(0);
    await expect(runtime.query(`INSERT INTO property_management.property_owners
      (owner_id, tenant_id, owner_type, first_name, last_name, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'INDIVIDUAL','Other','Owner',now(),now(),$3,'actor')`, ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", TENANT_B, CORRELATION]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("enforces discriminated identity and contact constraints", async () => {
    await owner.query("SET CONSTRAINTS ALL IMMEDIATE");
    await expect(owner.query(`INSERT INTO property_management.property_owners
      (owner_id, tenant_id, owner_type, first_name, last_name, legal_name, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'INDIVIDUAL','Jean','Kouassi','Forbidden',now(),now(),$3,'actor')`, [PROPERTY_ID, TENANT_A, CORRELATION]))
      .rejects.toMatchObject({ code: "23514" });
    await expect(owner.query(`INSERT INTO property_management.property_owners
      (owner_id, tenant_id, owner_type, legal_name, email, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'LEGAL_ENTITY','Company','invalid',now(),now(),$3,'actor')`, [PROPERTY_ID, TENANT_A, CORRELATION]))
      .rejects.toMatchObject({ code: "23514" });
  });
});

const OWNERSHIP_PROPERTY = "22222222-2222-4222-8222-222222222222";
const OWNERSHIP_OWNER_A = "33333333-3333-4333-8333-333333333333";
const OWNERSHIP_OWNER_B = "44444444-4444-4444-8444-444444444444";
function ownershipAuthority(tenantId: string) {
  return { actorId: "actor", authorityId: "authority", grants: ["ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER"] as const, tenantIds: [tenantId] };
}
async function ownershipFixture() {
  await create(undefined, TENANT_A, "SALE", OWNERSHIP_PROPERTY);
  await createOwner(undefined, TENANT_A, "INDIVIDUAL", OWNERSHIP_OWNER_A);
  await createOwner(undefined, TENANT_A, "LEGAL_ENTITY", OWNERSHIP_OWNER_B);
}

describe("PropertyOwnership PostgreSQL persistence", () => {
  it("persists, lists and removes multiple owners without deleting references", async () => {
    await ownershipFixture(); const repository = new PostgresPropertyOwnershipRepository(runtime);
    const assign = new AssignPropertyOwner(repository, { now: () => "2026-08-26T12:00:00.000Z" });
    await assign.execute({ authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION, propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_A, ownershipShare: 60 });
    await assign.execute({ authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION, propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_B, ownershipShare: 40 });
    await expect(new RetrievePropertyOwnerships(repository).execute({ authority: ownershipAuthority(TENANT_A), propertyId: OWNERSHIP_PROPERTY }))
      .resolves.toEqual([expect.objectContaining({ ownerId: OWNERSHIP_OWNER_A, ownershipShare: 60 }), expect.objectContaining({ ownerId: OWNERSHIP_OWNER_B, ownershipShare: 40 })]);
    await new RemovePropertyOwner(repository).execute({ authority: ownershipAuthority(TENANT_A), propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_A });
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_ownerships")).rows[0]?.count).toBe(1);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.properties WHERE property_id = $1", [OWNERSHIP_PROPERTY])).rows[0]?.count).toBe(1);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_owners WHERE owner_id = $1", [OWNERSHIP_OWNER_A])).rows[0]?.count).toBe(1);
  });

  it("supports one owner assigned to multiple properties", async () => {
    await ownershipFixture(); const secondProperty = "55555555-5555-4555-8555-555555555555"; await create(undefined, TENANT_A, "SALE", secondProperty);
    const assign = new AssignPropertyOwner(new PostgresPropertyOwnershipRepository(runtime), { now: () => "2026-08-26T12:00:00.000Z" });
    for (const propertyId of [OWNERSHIP_PROPERTY, secondProperty]) await assign.execute({
      authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION, propertyId, ownerId: OWNERSHIP_OWNER_A, ownershipShare: 50,
    });
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_ownerships WHERE owner_id = $1", [OWNERSHIP_OWNER_A])).rows[0]?.count).toBe(2);
  });

  it("rejects duplicate, exceeded total and missing relation removal", async () => {
    await ownershipFixture(); const repository = new PostgresPropertyOwnershipRepository(runtime);
    const assign = new AssignPropertyOwner(repository, { now: () => "2026-08-26T12:00:00.000Z" });
    const command = { authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION, propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_A, ownershipShare: 60 };
    await assign.execute(command);
    await expect(assign.execute(command)).rejects.toBeInstanceOf(PropertyOwnershipConflictError);
    await expect(assign.execute({ ...command, ownerId: OWNERSHIP_OWNER_B, ownershipShare: 40.01 })).rejects.toBeInstanceOf(PropertyOwnershipShareExceededError);
    await expect(new RemovePropertyOwner(repository).execute({ authority: ownershipAuthority(TENANT_A), propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_B }))
      .rejects.toBeInstanceOf(PropertyOwnershipNotFoundError);
  });

  it("prevents missing and cross-tenant references", async () => {
    await ownershipFixture(); const assign = new AssignPropertyOwner(new PostgresPropertyOwnershipRepository(runtime), { now: () => "2026-08-26T12:00:00.000Z" });
    await expect(assign.execute({ authority: ownershipAuthority(TENANT_B), correlationId: CORRELATION, propertyId: OWNERSHIP_PROPERTY, ownerId: OWNERSHIP_OWNER_A, ownershipShare: 10 }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(assign.execute({ authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION, propertyId: OWNERSHIP_PROPERTY, ownerId: "66666666-6666-4666-8666-666666666666", ownershipShare: 10 }))
      .rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
    await expect(owner.query(`INSERT INTO property_management.property_ownerships
      (tenant_id, property_id, owner_id, ownership_share, created_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,10,now(),$4,'actor')`, [TENANT_B, OWNERSHIP_PROPERTY, OWNERSHIP_OWNER_A, CORRELATION]))
      .rejects.toMatchObject({ code: "23503" });
  });

  it("enforces share constraints and forced RLS", async () => {
    await ownershipFixture();
    await expect(owner.query(`INSERT INTO property_management.property_ownerships
      (tenant_id, property_id, owner_id, ownership_share, created_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,0,now(),$4,'actor')`, [TENANT_A, OWNERSHIP_PROPERTY, OWNERSHIP_OWNER_A, CORRELATION]))
      .rejects.toMatchObject({ code: "23514" });
    expect((await runtime.query("SELECT * FROM property_management.property_ownerships")).rows).toHaveLength(0);
    await expect(runtime.query(`INSERT INTO property_management.property_ownerships
      (tenant_id, property_id, owner_id, ownership_share, created_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,10,now(),$4,'actor')`, [TENANT_A, OWNERSHIP_PROPERTY, OWNERSHIP_OWNER_A, CORRELATION]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("serializes concurrent assignments so the total cannot exceed 100", async () => {
    await ownershipFixture(); const repository = new PostgresPropertyOwnershipRepository(runtime);
    const assign = new AssignPropertyOwner(repository, { now: () => "2026-08-26T12:00:00.000Z" });
    const results = await Promise.allSettled([OWNERSHIP_OWNER_A, OWNERSHIP_OWNER_B].map((ownerId) => assign.execute({
      authority: ownershipAuthority(TENANT_A), correlationId: CORRELATION,
      propertyId: OWNERSHIP_PROPERTY, ownerId, ownershipShare: 60,
    })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await owner.query("SELECT COALESCE(sum(ownership_share), 0)::numeric AS total FROM property_management.property_ownerships WHERE property_id = $1", [OWNERSHIP_PROPERTY])).rows[0]?.total).toBe("60.00");
  });
});

const BUILDING_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"; const UNIT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
function compositionAuthority(tenantId: string) { return { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY_BUILDING", "RETRIEVE_PROPERTY_COMPOSITION", "UPDATE_PROPERTY_BUILDING", "CREATE_PROPERTY_UNIT", "UPDATE_PROPERTY_UNIT_STRUCTURE"] as const, tenantIds: [tenantId] }; }
function compositionUseCases(repository = new PostgresPropertyCompositionRepository(runtime), buildingIds: readonly string[] = [BUILDING_ID], unitIds: readonly string[] = [UNIT_ID]) {
  let buildingIndex = 0; let unitIndex = 0; const clock = { now: () => "2026-08-28T12:00:00.000Z" };
  const nextBuildingId = () => buildingIds[buildingIndex++] ?? "77777777-7777-4777-8777-777777777777";
  const nextUnitId = () => unitIds[unitIndex++] ?? "88888888-8888-4888-8888-888888888888";
  return { repository, createBuilding: new CreatePropertyBuilding(new PostgresPropertyRepository(runtime), repository, { generate: nextBuildingId }, clock), listBuildings: new ListPropertyBuildings(repository), updateBuilding: new UpdatePropertyBuilding(repository, clock), createUnit: new CreatePropertyUnit(repository, { generate: nextUnitId }, clock), listUnits: new ListPropertyUnits(repository), updateUnit: new UpdatePropertyUnitStructure(repository, clock) };
}
async function createCompositionParent(tenantId = TENANT_A, propertyId = PROPERTY_ID) { await create(undefined, tenantId, "SALE", propertyId); }
const unitFields = { unitCode: "A-101", title: "Appartement A-101", propertyType: "APARTMENT" as const, transactionType: "LONG_TERM_RENTAL" as const,
  apartmentSubtype: "STUDIO" as const, location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" } };

describe("Property composition PostgreSQL persistence", () => {
  it("refuse de persister une Unit par le repository générique sans relation", async () => {
    const unit = Property.createUnit({
      propertyId: UNIT_ID, tenantId: TENANT_A, title: "Orpheline", propertyType: "APARTMENT", transactionType: "SALE",
      location: unitFields.location, createdAt: "2026-08-28T12:00:00.000Z", updatedAt: "2026-08-28T12:00:00.000Z",
    });
    await expect(new PostgresPropertyRepository(runtime).saveStandalone(unit, CORRELATION, "actor"))
      .rejects.toBeInstanceOf(PropertyStructuralRoleConflictError);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.properties")).rows[0]?.count).toBe(0);
  });

  it("refuse de charger une Unit persistée sans son unique relation Building", async () => {
    await owner.query(`INSERT INTO property_management.properties
      (property_id, tenant_id, title, property_type, transaction_type, status, structural_role,
       country, city, district, address_line, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'Unit orpheline','APARTMENT','SALE','DRAFT','UNIT',
       'CI','Abidjan','Cocody','Rue 1',now(),now(),$3,'actor')`, [UNIT_ID, TENANT_A, CORRELATION]);

    await expect(new PostgresPropertyRepository(runtime).findById(TENANT_A, UNIT_ID))
      .rejects.toBeInstanceOf(PersistedPropertyCorruptionError);
  });

  it("refuse de modifier le rôle structurel par le repository générique", async () => {
    const repository = new PostgresPropertyRepository(runtime);
    await create(repository);

    await expect(repository.updateAtomically(
      TENANT_A,
      PROPERTY_ID,
      (property) => property.becomeComposite("2026-08-28T12:00:00.000Z"),
      { correlationId: CORRELATION, actorId: "actor" },
    )).rejects.toBeInstanceOf(PropertyStructuralRoleConflictError);
    expect((await owner.query("SELECT structural_role FROM property_management.properties WHERE property_id=$1", [PROPERTY_ID])).rows[0]?.structural_role)
      .toBe("STANDALONE");
  });

  it("crée, lit et modifie Building puis Unit avec les rôles normatifs", async () => { await createCompositionParent(); const useCases = compositionUseCases(); const authority = compositionAuthority(TENANT_A);
    await useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: " bat-a ", name: " Immeuble A " });
    expect((await owner.query("SELECT structural_role FROM property_management.properties WHERE property_id=$1", [PROPERTY_ID])).rows[0]?.structural_role).toBe("COMPOSITE");
    await useCases.updateBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, buildingCode: "BAT-B", name: "Immeuble B" });
    const createdUnit = await useCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields }); expect(createdUnit.property.structuralRole).toBe("UNIT");
    await useCases.updateUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, unitPropertyId: UNIT_ID, unitCode: "B-102" });
    expect((await useCases.listBuildings.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, limit: 20 })).items[0]).toMatchObject({ buildingCode: "BAT-B", name: "Immeuble B" });
    expect((await useCases.listUnits.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, limit: 20 })).items[0]).toMatchObject({ unitCode: "B-102", property: { propertyId: UNIT_ID, structuralRole: "UNIT" } });
  });
  it("publie indépendamment une racine COMPOSITE et sa Property UNIT sans cascade", async () => {
    await createCompositionParent(); const useCases = compositionUseCases(); const composition = compositionAuthority(TENANT_A);
    await useCases.createBuilding.execute({ authority: composition, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" });
    await useCases.createUnit.execute({ authority: composition, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields });
    await insertStudioPhotoSet(TENANT_A, UNIT_ID);
    const repository = new PostgresPropertyRepository(runtime);
    const details = new UpdatePropertyDetails(repository, { now: () => "2026-08-28T13:00:00.000Z" });
    const detailsAuthority = { ...authority(TENANT_A), grants: ["UPDATE_PROPERTY_DETAILS"] as const };
    await details.execute({ authority: detailsAuthority, correlationId: CORRELATION, propertyId: PROPERTY_ID,
      details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 } });
    await details.execute({ authority: detailsAuthority, correlationId: CORRELATION, propertyId: UNIT_ID,
      details: { rooms: 1 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" } });
    const publish = new PublishProperty(repository, { now: () => "2026-08-28T14:00:00.000Z" });
    const publishAuthority = { ...authority(TENANT_A), grants: ["PUBLISH_PROPERTY"] as const };
    await expect(publish.execute({ authority: publishAuthority, correlationId: PUBLICATION_CORRELATION, propertyId: UNIT_ID }))
      .resolves.toMatchObject({ property: { status: "PUBLISHED", structuralRole: "UNIT" } });
    expect((await owner.query("SELECT property_id, status FROM property_management.properties ORDER BY property_id")).rows)
      .toEqual(expect.arrayContaining([{ property_id: PROPERTY_ID, status: "DRAFT" }, { property_id: UNIT_ID, status: "PUBLISHED" }]));
    await expect(publish.execute({ authority: publishAuthority, correlationId: REPLAY_CORRELATION, propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ property: { status: "PUBLISHED", structuralRole: "COMPOSITE" } });
  });
  it("refuse un Building sous une Unit et rollbacke une création Unit conflictuelle", async () => { await createCompositionParent(); const useCases = compositionUseCases(undefined, [BUILDING_ID], [UNIT_ID, "11111111-1111-4111-8111-111111111111"]); const authority = compositionAuthority(TENANT_A); await useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" }); await useCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields });
    await expect(useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: UNIT_ID, buildingCode: "NEST", name: "Interdit" })).rejects.toBeInstanceOf(PropertyStructuralRoleConflictError);
    await expect(useCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields })).rejects.toBeInstanceOf(PropertyUnitCodeConflictError);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.properties")).rows[0]?.count).toBe(2);
  });
  it("applique unicité, références tenant composites et RLS forcée", async () => { await createCompositionParent(); const useCases = compositionUseCases(undefined, [BUILDING_ID, "11111111-1111-4111-8111-111111111111"]); const authority = compositionAuthority(TENANT_A); await useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" });
    await expect(useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "bat-a", name: "Doublon" })).rejects.toBeInstanceOf(PropertyBuildingCodeConflictError);
    expect((await runtime.query("SELECT * FROM property_management.property_buildings")).rows).toHaveLength(0);
    await expect(owner.query(`INSERT INTO property_management.property_buildings (building_id,tenant_id,property_id,building_code,name,created_at,updated_at,correlation_id,actor_id) VALUES ($1,$2,$3,'BAD','Bad',now(),now(),$4,'actor')`, ["22222222-2222-4222-8222-222222222222", TENANT_B, PROPERTY_ID, CORRELATION])).rejects.toMatchObject({ code: "23503" });
    await expect(runtime.query(`INSERT INTO property_management.property_buildings (building_id,tenant_id,property_id,building_code,name,created_at,updated_at,correlation_id,actor_id) VALUES ($1,$2,$3,'BAD','Bad',now(),now(),$4,'actor')`, ["33333333-3333-4333-8333-333333333333", TENANT_A, PROPERTY_ID, CORRELATION])).rejects.toMatchObject({ code: "42501" });
  });
  it("isole aussi les relations Unit par tenant et par RLS", async () => {
    await createCompositionParent(); const useCases = compositionUseCases(); const authority = compositionAuthority(TENANT_A);
    await useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" });
    await useCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields });
    await expect(useCases.listUnits.execute({ authority: compositionAuthority(TENANT_B), correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, limit: 20 }))
      .rejects.toBeInstanceOf(PropertyBuildingNotFoundError);
    await expect(useCases.updateUnit.execute({ authority: compositionAuthority(TENANT_B), correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, unitPropertyId: UNIT_ID, unitCode: "B-999" }))
      .rejects.toBeInstanceOf(PropertyUnitNotFoundError);
    expect((await runtime.query("SELECT * FROM property_management.property_building_units")).rows).toHaveLength(0);
    await expect(runtime.query(`INSERT INTO property_management.property_building_units
      (tenant_id,building_id,unit_property_id,unit_code,created_at,updated_at,correlation_id,actor_id)
      VALUES ($1,$2,$3,'A-999',now(),now(),$4,'actor')`, [TENANT_A, BUILDING_ID, UNIT_ID, CORRELATION])).rejects.toMatchObject({ code: "42501" });
    expect((await owner.query("SELECT unit_code FROM property_management.property_building_units WHERE unit_property_id=$1", [UNIT_ID])).rows[0]?.unit_code).toBe("A-101");
  });
  it("pagine Buildings et Units dans un ordre déterministe sans duplication", async () => { await createCompositionParent(); const buildingIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]; const unitIds = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"]; const useCases = compositionUseCases(undefined, buildingIds, unitIds); const authority = compositionAuthority(TENANT_A);
    for (const code of ["BAT-C", "BAT-A", "BAT-B"]) await useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: code, name: code }); const first = await useCases.listBuildings.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, limit: 2 }); const second = await useCases.listBuildings.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, limit: 2, cursor: first.nextCursor }); expect([...first.items, ...second.items].map((item) => item.buildingCode)).toEqual(["BAT-A", "BAT-B", "BAT-C"]);
    const target = first.items[0]!.buildingId; for (const code of ["A-103", "A-101", "A-102"]) await useCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: target, ...unitFields, unitCode: code }); const unitFirst = await useCases.listUnits.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: target, limit: 2 }); const unitSecond = await useCases.listUnits.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: target, limit: 2, cursor: unitFirst.nextCursor }); expect([...unitFirst.items, ...unitSecond.items].map((item) => item.unitCode)).toEqual(["A-101", "A-102", "A-103"]);
  });
  it("sérialise les codes concurrents sous verrou parent", async () => { await createCompositionParent(); const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]; const useCases = compositionUseCases(undefined, ids); const authority = compositionAuthority(TENANT_A); const results = await Promise.allSettled(ids.map((_, index) => useCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-X", name: `B${index}` }))); expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1); expect(results.filter((result) => result.status === "rejected")).toHaveLength(1); expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_buildings")).rows[0]?.count).toBe(1); });
  it("sérialise les codes Unit concurrents et ne masque pas une collision d’identifiant en conflit de code", async () => {
    await createCompositionParent(); const authority = compositionAuthority(TENANT_A);
    const buildingCases = compositionUseCases(undefined, [BUILDING_ID, BUILDING_ID]);
    await buildingCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" });
    await expect(buildingCases.createBuilding.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingCode: "BAT-B", name: "B" }))
      .rejects.not.toBeInstanceOf(PropertyBuildingCodeConflictError);

    const unitIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const unitCases = compositionUseCases(undefined, [], unitIds);
    const results = await Promise.allSettled(unitIds.map(() => unitCases.createUnit.execute({ authority, correlationId: CORRELATION, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields, unitCode: "A-X" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_building_units WHERE unit_code='A-X'")).rows[0]?.count).toBe(1);
  });
});
