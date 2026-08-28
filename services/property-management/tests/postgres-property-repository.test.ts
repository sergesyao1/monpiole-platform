import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, PostgresPropertyOwnerDirectoryQuery,
  PostgresPropertyOwnerRepository, PostgresPropertyPortfolioQuery, PostgresPropertyRepository,
  PropertyNotFoundError, PropertyOwnerNotFoundError, PropertyOwnerTypeChangeNotAllowedError,
  RetrieveProperty, RetrievePropertyOwner, UpdatePropertyDetails, UpdatePropertyOwner, type TransactionType,
  AssignPropertyOwner, PostgresPropertyOwnershipRepository, PropertyOwnershipConflictError,
  PropertyOwnershipShareExceededError, PropertyOwnershipNotFoundError, RemovePropertyOwner, RetrievePropertyOwnerships,
} from "../src/index.js";

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
  await owner.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA property_management TO property_runtime");
  runtime = new Pool({ connectionString: connection("property_runtime", "synthetic-runtime") });
});
afterEach(async () => owner.query("TRUNCATE property_management.property_ownerships, property_management.properties, property_management.property_owners"));
afterAll(async () => { await runtime?.end(); await owner?.end(); await container?.stop(); });

function authority(tenantId: string) { return { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"] as const, tenantIds: [tenantId] }; }
function create(repository = new PostgresPropertyRepository(runtime), tenantId = TENANT_A, transactionType: TransactionType = "SALE", propertyId = PROPERTY_ID) {
  return new CreateProperty(repository, { generate: () => propertyId }, { now: () => "2026-08-25T12:00:00.000Z" }).execute({
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
