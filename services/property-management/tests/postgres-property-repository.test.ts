import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CreateProperty, PostgresPropertyRepository, RetrieveProperty, PropertyNotFoundError, UpdatePropertyDetails, type TransactionType } from "../src/index.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; const CORRELATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let container: StartedTestContainer; let owner: Pool; let runtime: Pool;
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

beforeAll(async () => {
  container = await new GenericContainer(IMAGE).withEnvironment({ POSTGRES_DB: "property_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner" })
    .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  const connection = (user: string, password: string) => `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/property_test`;
  owner = new Pool({ connectionString: connection("owner", "synthetic-owner") });
  await owner.query("CREATE ROLE property_runtime LOGIN PASSWORD 'synthetic-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(owner), { migrationsFolder });
  await owner.query("GRANT USAGE ON SCHEMA property_management TO property_runtime");
  await owner.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA property_management TO property_runtime");
  runtime = new Pool({ connectionString: connection("property_runtime", "synthetic-runtime") });
});
afterEach(async () => owner.query("TRUNCATE property_management.properties"));
afterAll(async () => { await runtime?.end(); await owner?.end(); await container?.stop(); });

function authority(tenantId: string) { return { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"] as const, tenantIds: [tenantId] }; }
function create(repository = new PostgresPropertyRepository(runtime), tenantId = TENANT_A, transactionType: TransactionType = "SALE") {
  return new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }).execute({
    authority: authority(tenantId), correlationId: CORRELATION, title: "House", propertyType: "HOUSE", transactionType,
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
}

describe("Property PostgreSQL persistence", () => {
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
});
