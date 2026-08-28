import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { createPostgresApiRuntime, type PostgresApiRuntime } from "../../apps/api/src/composition/create-postgres-runtime-composition.js";
import {
  ActivateTenantAdministrator, BootstrapTenantAdministrator, ExternalIdentity,
  HasActiveTenantAdministrator, PostgresIdentityStore, PostgresPlatformIdentityInitializationState,
} from "../../services/identity/src/index.js";
import {
  ActivateTenant, CheckTenantExists, CreateTenant, PostgresActivateTenantUnitOfWork,
  PostgresCreateTenantUnitOfWork, PostgresPlatformTenantInitializationState, PostgresTenantExistenceRepository,
} from "../../services/tenant-management/src/index.js";
import { InitialPlatformBootstrap, PlatformAlreadyInitializedError } from "../../apps/api/src/operations/initial-platform-bootstrap.js";
import { PostgresInitialPlatformBootstrapLock } from "../../apps/api/src/operations/postgres-initial-platform-bootstrap-lock.js";
import { OnboardingAuthorityPolicy } from "../../apps/api/src/composition/onboarding-authority-policy.js";
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
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA property_management TO api_runtime");
  runtimePool = new Pool({ connectionString: connectionString("api_runtime", RUNTIME_PASSWORD), max: 4 });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await runtime?.close();
  runtime = undefined;
  await ownerPool.query("TRUNCATE identity.tenant_memberships, identity.identities CASCADE");
  await ownerPool.query("TRUNCATE tenant_management.outbox, tenant_management.create_tenant_idempotency, tenant_management.tenants CASCADE");
  await ownerPool.query("TRUNCATE property_management.property_ownerships, property_management.properties, property_management.property_owners");
  authorizedTenantIds.clear();
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

async function start() {
  runtime = createPostgresApiRuntime(runtimeEnvironment());
  application = await createApiApplication({ logger: false }, {
    ...runtime.composition,
    authenticatedAuthorityProvider: { resolve: async () => ({
      actorId: "runtime-test", authorityId: "platform-test",
      grants: [
        "CREATE_TENANT", "BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT",
        "CREATE_PROPERTY", "RETRIEVE_PROPERTY", "LIST_PROPERTIES", "UPDATE_PROPERTY_DETAILS",
        "CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "LIST_PROPERTY_OWNERS", "UPDATE_PROPERTY_OWNER",
        "ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER",
      ],
      tenantIds: [...authorizedTenantIds],
    }) },
  });
  await listen();
}

function runtimeEnvironment(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: connectionString("api_runtime", RUNTIME_PASSWORD),
    DATABASE_POOL_MAX: "4", DATABASE_CONNECTION_TIMEOUT_MS: "2500", DATABASE_IDLE_TIMEOUT_MS: "12000",
    DATABASE_TLS: "disabled", NODE_ENV: "test",
    AUTHENTICATION_ISSUER: "https://login.runtime.test/",
    AUTHENTICATION_AUDIENCE: "https://api.monpiole.test",
    AUTHENTICATION_JWKS_URI: "https://login.runtime.test/.well-known/jwks.json",
  };
}

async function listen() {
  if (application === undefined) throw new Error("API application was not composed");
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
  it("bootstraps the first active tenant authority once through approved use cases", async () => {
    const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const identityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const policy = new OnboardingAuthorityPolicy();
    const identityStore = new PostgresIdentityStore(runtimePool);
    const tenantExists = new CheckTenantExists(new PostgresTenantExistenceRepository(runtimePool));
    const activeAdministrator = new HasActiveTenantAdministrator(identityStore);
    const operation = new InitialPlatformBootstrap({
      lock: new PostgresInitialPlatformBootstrapLock(runtimePool),
      tenantState: new PostgresPlatformTenantInitializationState(runtimePool),
      identityState: new PostgresPlatformIdentityInitializationState(runtimePool),
      createTenant: new CreateTenant(
        policy, new PostgresCreateTenantUnitOfWork(runtimePool), { generate: () => tenantId },
        { generate: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
        { now: () => "2026-08-26T12:00:00.000Z" },
      ),
      bootstrapAdministrator: new BootstrapTenantAdministrator(
        { exists: (candidate) => tenantExists.execute(candidate) }, identityStore,
        { generate: () => identityId }, policy,
      ),
      activateAdministrator: new ActivateTenantAdministrator(identityStore, policy),
      activateTenant: new ActivateTenant(
        new PostgresActivateTenantUnitOfWork(runtimePool),
        { hasActiveTenantAdministrator: (candidate) => activeAdministrator.execute(candidate) },
        { generate: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
        { now: () => "2026-08-26T12:01:00.000Z" }, policy,
      ),
      correlationId: CORRELATION_ID, expectedTenantId: tenantId, expectedIdentityId: identityId,
    });
    const configuration = {
      operatorId: "installation-operator", idempotencyKey: "initial-platform",
      organizationName: "Initial Agency", responsiblePersonName: "Ada Operator",
      responsibleEmail: "operator@example.invalid", responsibleTelephone: "+2250102030405", country: "CI",
      administratorEmail: "admin@example.invalid", administratorFirstName: "Alice", administratorLastName: "Admin",
    };

    await expect(operation.execute(configuration)).resolves.toEqual({
      tenantId, tenantLifecycleState: "ACTIVE", internalIdentityId: identityId,
      identityStatus: "ACTIVE", role: "TENANT_ADMINISTRATOR",
    });
    expect((await ownerPool.query("SELECT lifecycle_state FROM tenant_management.tenants WHERE id = $1", [tenantId])).rows[0])
      .toEqual({ lifecycle_state: "ACTIVE" });
    expect((await ownerPool.query("SELECT status FROM identity.identities WHERE id = $1", [identityId])).rows[0])
      .toEqual({ status: "ACTIVE" });
    expect((await ownerPool.query("SELECT role FROM identity.tenant_memberships WHERE identity_id = $1", [identityId])).rows[0])
      .toEqual({ role: "TENANT_ADMINISTRATOR" });
    await expect(operation.execute(configuration)).rejects.toBeInstanceOf(PlatformAlreadyInitializedError);
  });

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

  it("composes OIDC with durable external identity resolution across a runtime restart", async () => {
    await ownerPool.query(`INSERT INTO identity.identities
      (id, tenant_id, email, first_name, last_name, status, correlation_id)
      VALUES ($1, $2, 'oidc@example.invalid', 'OIDC', 'Admin', 'ACTIVE', $3)`,
    ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", CORRELATION_ID]);
    await ownerPool.query(`INSERT INTO identity.tenant_memberships
      (tenant_id, identity_id, role, correlation_id) VALUES ($1, $2, 'TENANT_ADMINISTRATOR', $3)`,
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", CORRELATION_ID]);

    const accessTokenVerifier = { verify: async (token: string) => {
      if (token !== "known-token") throw new Error("invalid token");
      return { issuer: "https://login.runtime.test/", subject: "auth0|known", authenticationMethods: [] };
    } };
    runtime = createPostgresApiRuntime(runtimeEnvironment(), { accessTokenVerifier });
    await runtime.externalIdentityStore.link(ExternalIdentity.create({
      issuer: "https://login.runtime.test/", subject: "auth0|known",
      internalIdentityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", createdAt: "2026-08-26T12:00:00Z",
    }));
    application = await createApiApplication({ logger: false }, runtime.composition);
    await listen();
    const propertyId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}`, {
      headers: { authorization: "Bearer known-token" },
    })).status).toBe(404);
    expect((await fetch(`${baseUrl}/v1/authentication/authorization/platform-tenant-creation`, {
      headers: { authorization: "Bearer known-token" },
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}`, {
      headers: { authorization: "Bearer unknown-token" },
    })).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST",
      headers: {
        authorization: "Bearer known-token", "content-type": "application/json", "idempotency-key": "forbidden-platform-create",
      },
      body: JSON.stringify({
        organizationName: "Forbidden Agency", responsiblePersonName: "OIDC Admin",
        responsibleEmail: "oidc@example.invalid", responsibleTelephone: "+2250102030405", country: "CI",
      }),
    })).status).toBe(403);

    await application.close(); application = undefined;
    await runtime.close(); runtime = undefined;
    runtime = createPostgresApiRuntime(runtimeEnvironment(), { accessTokenVerifier });
    application = await createApiApplication({ logger: false }, runtime.composition);
    await listen();
    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}`, {
      headers: { authorization: "Bearer known-token" },
    })).status).toBe(404);
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
    const portfolio = await fetch(`${baseUrl}/v1/properties?type=APARTMENT&search=Apartment&limit=1`);
    expect(portfolio.status).toBe(200); expect(await portfolio.json()).toMatchObject({
      items: [{ propertyId: property.propertyId, title: "Apartment" }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
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

  it("assigns, lists and removes PropertyOwnership through the real PostgreSQL API composition", async () => {
    await start(); await createTenant("ownership");
    const propertyResponse = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "House", propertyType: "HOUSE", transactionType: "SALE",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
      }),
    });
    expect(propertyResponse.status).toBe(201); const property = await propertyResponse.json() as { propertyId: string };
    const ownerResponse = await fetch(`${baseUrl}/v1/property-owners`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi", email: "jean@example.com",
      }),
    });
    expect(ownerResponse.status).toBe(201); const propertyOwner = await ownerResponse.json() as { ownerId: string };
    const ownerDirectory = await fetch(`${baseUrl}/v1/property-owners?search=Kouassi&limit=1`);
    expect(ownerDirectory.status).toBe(200); expect(await ownerDirectory.json()).toMatchObject({
      items: [{ ownerId: propertyOwner.ownerId, ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    const assigned = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/owners`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId: propertyOwner.ownerId, ownershipShare: 75 }),
    });
    expect(assigned.status).toBe(201); expect(await assigned.json()).toMatchObject({
      propertyId: property.propertyId, ownerId: propertyOwner.ownerId, ownershipShare: 75,
    });
    const listed = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/owners`);
    expect(listed.status).toBe(200); expect(await listed.json()).toEqual([expect.objectContaining({ ownerId: propertyOwner.ownerId })]);
    expect((await ownerPool.query("SELECT ownership_share FROM property_management.property_ownerships WHERE property_id = $1", [property.propertyId])).rows[0]?.ownership_share).toBe("75.00");
    const removed = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/owners/${propertyOwner.ownerId}`, { method: "DELETE" });
    expect(removed.status).toBe(204);
    expect((await ownerPool.query("SELECT count(*)::int AS count FROM property_management.property_ownerships")).rows[0]?.count).toBe(0);
  });
});
