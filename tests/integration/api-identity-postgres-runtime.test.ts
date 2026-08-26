import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { createPostgresApiRuntime, type PostgresApiRuntime } from "../../apps/api/src/composition/create-postgres-runtime-composition.js";
import { PostgresIdentityStore } from "../../services/identity/src/index.js";
import {
  GenericContainer, Pool, Wait, drizzle, migrate, type StartedTestContainer,
} from "../../services/identity/tests/postgres-runtime-test-harness.js";

const POSTGRES_IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tenantMigrations = fileURLToPath(new URL("../../services/tenant-management/migrations", import.meta.url));
const identityMigrations = fileURLToPath(new URL("../../services/identity/migrations", import.meta.url));
const propertyMigrations = fileURLToPath(new URL("../../services/property-management/migrations", import.meta.url));

let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;
let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
let runtime: PostgresApiRuntime | undefined;
let baseUrl: string;
const authorizedTenantIds = new Set<string>();

function connectionString(user: string, password: string): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/runtime_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_DB: "runtime_test", POSTGRES_PASSWORD: OWNER_PASSWORD, POSTGRES_USER: "migration_owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(`CREATE ROLE api_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await migrate(drizzle(ownerPool), { migrationsFolder: tenantMigrations, migrationsTable: "tenant_management_migrations" });
  await migrate(drizzle(ownerPool), { migrationsFolder: identityMigrations, migrationsTable: "identity_migrations" });
  await migrate(drizzle(ownerPool), { migrationsFolder: propertyMigrations, migrationsTable: "property_management_migrations" });
  await ownerPool.query("GRANT USAGE ON SCHEMA tenant_management, identity, property_management TO api_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO api_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO api_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA property_management TO api_runtime");
  runtimePool = new Pool({ connectionString: connectionString("api_runtime", RUNTIME_PASSWORD), max: 4 });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await runtime?.close();
  runtime = undefined;
  await ownerPool.query("TRUNCATE identity.tenant_memberships, identity.identities CASCADE");
  await ownerPool.query("TRUNCATE tenant_management.outbox, tenant_management.create_tenant_idempotency, tenant_management.tenants CASCADE");
  await ownerPool.query("TRUNCATE property_management.properties");
  authorizedTenantIds.clear();
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

async function start() {
  runtime = createPostgresApiRuntime({
    DATABASE_URL: connectionString("api_runtime", RUNTIME_PASSWORD),
    DATABASE_POOL_MAX: "4", DATABASE_CONNECTION_TIMEOUT_MS: "2500", DATABASE_IDLE_TIMEOUT_MS: "12000",
    DATABASE_TLS: "disabled", NODE_ENV: "test",
  });
  application = await createApiApplication({ logger: false }, {
    ...runtime.composition,
    authenticatedAuthorityProvider: { resolve: async () => ({
      actorId: "runtime-test", authorityId: "platform-test",
      grants: ["CREATE_TENANT", "BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT", "CREATE_PROPERTY", "RETRIEVE_PROPERTY", "UPDATE_PROPERTY_DETAILS"],
      tenantIds: [...authorizedTenantIds],
    }) },
  });
  await application.listen(0, "127.0.0.1");
  const address = application.getHttpServer().address();
  if (address === null || typeof address === "string") throw new Error("API did not bind a port");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function createTenant(sequence: string) {
  const response = await fetch(`${baseUrl}/api/v1/tenants`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `runtime-${sequence}` },
    body: JSON.stringify({
      organizationName: `Agency ${sequence}`, responsiblePersonName: "Ada Example",
      responsibleEmail: `owner-${sequence}@example.invalid`, responsibleTelephone: "+2250102030405", country: "CI",
    }),
  });
  expect(response.status).toBe(201);
  const tenantId = (await response.json() as { tenantId: string }).tenantId;
  authorizedTenantIds.add(tenantId);
  return tenantId;
}

async function bootstrap(tenantId: string, email = "admin@example.com") {
  const response = await fetch(`${baseUrl}/v1/tenants/${tenantId}/administrators/bootstrap`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, firstName: "Alice", lastName: "Admin" }),
  });
  expect(response.status).toBe(201);
  return await response.json() as { administratorId: string; status: string };
}

async function activateAdministrator(tenantId: string, administratorId: string) {
  return fetch(`${baseUrl}/v1/tenants/${tenantId}/administrators/${administratorId}/activate`, { method: "POST" });
}

async function activateTenant(tenantId: string) {
  return fetch(`${baseUrl}/api/v1/tenants/${tenantId}/activate`, { method: "POST" });
}

describe("API PostgreSQL Identity runtime composition", () => {
  it("persists bootstrap and reloads it through a fresh store", async () => {
    await start(); const tenantId = await createTenant("bootstrap");
    const administrator = await bootstrap(tenantId);
    expect(administrator.status).toBe("PENDING_ACTIVATION");
    await expect(new PostgresIdentityStore(runtimePool).findIdentityById(administrator.administratorId, tenantId))
      .resolves.toMatchObject({ id: administrator.administratorId, status: "PENDING_ACTIVATION" });
  });

  it("activates a persisted administrator and reloads ACTIVE through a fresh store", async () => {
    await start(); const tenantId = await createTenant("administrator-active");
    const administrator = await bootstrap(tenantId);
    expect((await activateAdministrator(tenantId, administrator.administratorId)).status).toBe(200);
    await expect(new PostgresIdentityStore(runtimePool).findIdentityById(administrator.administratorId, tenantId))
      .resolves.toMatchObject({ id: administrator.administratorId, status: "ACTIVE" });
  });

  it("completes create, bootstrap, administrator activation, and tenant activation", async () => {
    await start(); const tenantId = await createTenant("complete");
    const administrator = await bootstrap(tenantId);
    expect((await activateAdministrator(tenantId, administrator.administratorId)).status).toBe(200);
    const response = await activateTenant(tenantId);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tenantId, lifecycleState: "ACTIVE" });
    expect((await ownerPool.query("SELECT lifecycle_state FROM tenant_management.tenants WHERE id = $1", [tenantId]))
      .rows[0]?.lifecycle_state).toBe("ACTIVE");
  });

  it("does not let Tenant A administrator readiness activate Tenant B", async () => {
    await start();
    const tenantA = await createTenant("tenant-a");
    const tenantB = await createTenant("tenant-b");
    const administratorA = await bootstrap(tenantA, "admin-a@example.com");
    expect((await activateAdministrator(tenantA, administratorA.administratorId)).status).toBe(200);
    const response = await activateTenant(tenantB);
    expect(response.status).toBe(409);
    expect((await ownerPool.query("SELECT lifecycle_state FROM tenant_management.tenants WHERE id = $1", [tenantB]))
      .rows[0]?.lifecycle_state).toBe("PENDING");
  });

  it("persists and retrieves a Property through the real PostgreSQL API composition", async () => {
    await start(); const tenantId = await createTenant("property");
    const created = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "Apartment", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
      }),
    });
    expect(created.status).toBe(201); const property = await created.json() as { propertyId: string; status: string };
    expect(property.status).toBe("DRAFT");
    expect((await ownerPool.query("SELECT tenant_id, status FROM property_management.properties WHERE property_id = $1", [property.propertyId])).rows[0])
      .toEqual({ tenant_id: tenantId, status: "DRAFT" });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${property.propertyId}`);
    expect(retrieved.status).toBe(200); expect(await retrieved.json()).toMatchObject({ propertyId: property.propertyId, status: "DRAFT" });
    const updated = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/details`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        details: { usableSurfaceSquareMeters: 72, rooms: 3, bedrooms: 2, bathrooms: 1 },
        commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 300_000, rentPeriod: "MONTH" },
      }),
    });
    expect(updated.status).toBe(200);
    expect((await ownerPool.query("SELECT commercial_kind, rent_amount_minor FROM property_management.properties WHERE property_id = $1", [property.propertyId])).rows[0])
      .toEqual({ commercial_kind: "LONG_TERM_RENTAL", rent_amount_minor: "300000" });
  });
});
