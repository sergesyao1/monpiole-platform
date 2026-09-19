import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

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
const agencyOnboardingMigrations = fileURLToPath(new URL("../../services/agency-onboarding/migrations", import.meta.url));

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

async function insertPrimaryPhoto(tenantId: string, propertyId: string) {
  await ownerPool.query(`INSERT INTO property_management.property_photos
    (photo_id, tenant_id, property_id, category, status, is_primary, content_base64, content_type,
     content_byte_size, content_sha256, registered_at, available_at, media_kind, gallery_position)
    VALUES ($1,$2,$3,'BUILDING_EXTERIOR_OR_ENTRANCE','AVAILABLE',true,'iVBORw0KGgo=','image/png',8,
      '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now(),'IMAGE',0)`,
  [randomUUID(), tenantId, propertyId]);
}

async function insertStudioPhotoSet(tenantId: string, propertyId: string) {
  await insertPrimaryPhoto(tenantId, propertyId);
  for (const [index, category] of ["MAIN_LIVING_SLEEPING_AREA", "KITCHEN_OR_KITCHENETTE", "BATHROOM_OR_SHOWER_ROOM", "OTHER", "OTHER"].entries()) {
    await ownerPool.query(`INSERT INTO property_management.property_photos
      (photo_id, tenant_id, property_id, category, status, is_primary, content_base64, content_type,
       content_byte_size, content_sha256, registered_at, available_at, media_kind, gallery_position)
      VALUES ($1,$2,$3,$4,'AVAILABLE',false,'iVBORw0KGgo=','image/png',8,
        '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now(),'IMAGE',$5)`,
    [randomUUID(), tenantId, propertyId, category, index + 1]);
  }
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_DB: "runtime_test", POSTGRES_PASSWORD: OWNER_PASSWORD, POSTGRES_USER: "migration_owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(`CREATE ROLE monpiole_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await ownerPool.query("CREATE ROLE monpiole_public_catalog_reader LOGIN PASSWORD 'synthetic-public-reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(ownerPool), { migrationsFolder: tenantMigrations, migrationsTable: "tenant_management_migrations" });
  await migrate(drizzle(ownerPool), { migrationsFolder: identityMigrations, migrationsTable: "identity_migrations" });
  await migrate(drizzle(ownerPool), { migrationsFolder: propertyMigrations, migrationsTable: "property_management_migrations" });
  await migrate(drizzle(ownerPool), {
    migrationsFolder: agencyOnboardingMigrations,
    migrationsTable: "agency_onboarding_migrations",
  });
  await ownerPool.query("GRANT USAGE ON SCHEMA tenant_management, identity TO monpiole_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO monpiole_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO monpiole_runtime");
  await ownerPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    property_management.properties,
    property_management.property_owners,
    property_management.property_ownerships,
    property_management.property_buildings,
    property_management.property_building_units
    TO monpiole_runtime`);
  runtimePool = new Pool({ connectionString: connectionString("monpiole_runtime", RUNTIME_PASSWORD), max: 4 });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await runtime?.close();
  runtime = undefined;
  const agencyOnboardingSchemaExists = await ownerPool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_namespace
      WHERE nspname = 'agency_onboarding'
    ) AS exists
  `);

  if (agencyOnboardingSchemaExists.rows[0]?.exists) {
    await ownerPool.query(`
      TRUNCATE
        agency_onboarding.agency_registration_administrators,
        agency_onboarding.agency_registration_documents,
        agency_onboarding.agency_registration_document_uploads,
        agency_onboarding.agency_registrations
    `);
  }
  await ownerPool.query("TRUNCATE identity.tenant_memberships, identity.identities CASCADE");
  await ownerPool.query("TRUNCATE tenant_management.outbox, tenant_management.create_tenant_idempotency, tenant_management.tenants CASCADE");
  await ownerPool.query("TRUNCATE property_management.property_application_contract_origins, property_management.property_application_client_conversions, property_management.property_applications, property_management.property_viewing_outcomes, property_management.property_viewings, property_management.property_inquiry_communications, property_management.property_inquiries, property_management.property_amenities, property_management.property_contracts, property_management.property_clients, property_management.property_primary_photo_audits, property_management.property_photo_standards, property_management.property_photos, property_management.property_geolocations, property_management.property_building_units, property_management.property_complex_children, property_management.property_buildings, property_management.property_ownerships, property_management.properties, property_management.property_owners");
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
        "CREATE_PROPERTY", "RETRIEVE_PROPERTY", "LIST_PROPERTIES", "UPDATE_PROPERTY_DETAILS", "UPDATE_PROPERTY_CORE_INFORMATION", "UPDATE_PROPERTY_PRICING",
        "PUBLISH_PROPERTY", "WITHDRAW_PROPERTY_FROM_CATALOG",
        "RETRIEVE_PROPERTY_AVAILABILITY", "UPDATE_PROPERTY_AVAILABILITY",
        "CREATE_PROPERTY_PHOTO", "RETRIEVE_PROPERTY_PHOTOS", "SELECT_PROPERTY_PRIMARY_PHOTO", "DELETE_PROPERTY_PHOTO", "REORDER_PROPERTY_PHOTOS",
        "RETRIEVE_PROPERTY_PHOTO_STANDARD", "MANAGE_PROPERTY_PHOTO_STANDARD",
        "CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "LIST_PROPERTY_OWNERS", "UPDATE_PROPERTY_OWNER",
        "ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER",
        "CREATE_PROPERTY_BUILDING", "RETRIEVE_PROPERTY_COMPOSITION", "UPDATE_PROPERTY_BUILDING",
        "CREATE_PROPERTY_UNIT", "UPDATE_PROPERTY_UNIT_STRUCTURE",
        "RETRIEVE_PROPERTY_WORKSPACE",
        "CREATE_PROPERTY_CLIENT", "RETRIEVE_PROPERTY_CLIENTS",
        "CREATE_PROPERTY_CONTRACT", "RETRIEVE_PROPERTY_CONTRACTS",
        "UPDATE_PROPERTY_CONTRACT", "MANAGE_PROPERTY_CONTRACT_LIFECYCLE",
      ],
      tenantIds: [...authorizedTenantIds],
    }) },
  });
  await listen();
}

function runtimeEnvironment(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: connectionString("monpiole_runtime", RUNTIME_PASSWORD),
    DATABASE_POOL_MAX: "4", DATABASE_CONNECTION_TIMEOUT_MS: "2500", DATABASE_IDLE_TIMEOUT_MS: "12000",
    DATABASE_TLS: "disabled", NODE_ENV: "test",
    AUTHENTICATION_ISSUER: "https://login.runtime.test/",
    AUTHENTICATION_AUDIENCE: "https://api.monpiole.test",
    AUTHENTICATION_JWKS_URI: "https://login.runtime.test/.well-known/jwks.json",
    AGENCY_FIRST_ADMIN_BOOTSTRAP_TOKEN_TTL_SECONDS: "3600",
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

  it("finalizes the first agency administrator through real PostgreSQL HTTP and converges on replay", async () => {
    const registrationId = "11111111-1111-4111-8111-111111111111";
    const tenantId = "22222222-2222-4222-8222-222222222222";
    const administratorId = "33333333-3333-4333-8333-333333333333";
    const reviewerId = "44444444-4444-4444-8444-444444444444";
    const bootstrapToken = "synthetic-valid-first-administrator-bootstrap-token";
    const bootstrapTokenHash = createHash("sha256").update(bootstrapToken, "utf8").digest("hex");
    const issuer = "https://login.runtime.test/";
    const subject = "auth0|first-administrator";
    const createdAt = "2026-09-18T20:00:00.000Z";

    await ownerPool.query(`INSERT INTO tenant_management.tenants
      (id, organization_name, responsible_person_name, responsible_email, responsible_telephone, country,
       lifecycle_state, created_at, correlation_id, actor_id, authority_id, activated_at)
      VALUES ($1,'Agence Runtime','Awa Runtime','agency-runtime@example.invalid','+2250102030405','CI',
        'PENDING',$2,$3,'platform-reviewer','platform-reviewer',NULL)`, [tenantId, createdAt, CORRELATION_ID]);
    await ownerPool.query(`INSERT INTO identity.identities
      (id, tenant_id, email, first_name, last_name, status, correlation_id)
      VALUES ($1,$2,'admin-runtime@example.invalid','Awa','Admin','PENDING_ACTIVATION',$3)`,
    [administratorId, tenantId, CORRELATION_ID]);
    await ownerPool.query(`INSERT INTO identity.tenant_memberships
      (tenant_id, identity_id, role, correlation_id) VALUES ($1,$2,'TENANT_ADMINISTRATOR',$3)`,
    [tenantId, administratorId, CORRELATION_ID]);
    await ownerPool.query(`INSERT INTO agency_onboarding.agency_registrations
      (registration_id,status,agency_legal_name,agency_trade_name,registration_number,tax_identifier,
       phone,email,website,address,city,country_code,contact_first_name,contact_last_name,contact_email,
       contact_phone,submitted_at,review_started_at,reviewed_by_identity_id,approved_at,rejected_at,
       rejection_reason,approval_provisioning_started_at,provisioned_tenant_id,created_at,updated_at,correlation_id)
      VALUES ($1,'APPROVED','Agence Runtime',NULL,'CI-RUNTIME-001',NULL,'+2250102030405',
        'agency-runtime@example.invalid',NULL,'Cocody','Abidjan','CI','Awa','Runtime',
        'awa.runtime@example.invalid','+2250506070809',$2,$2,$3,$2,NULL,NULL,$2,$4,$2,$2,$5)`,
    [registrationId, createdAt, reviewerId, tenantId, CORRELATION_ID]);
    await ownerPool.query(`INSERT INTO agency_onboarding.agency_registration_administrators
      (registration_id,tenant_id,internal_identity_id,administrator_kind,status,bootstrap_token_hash,
       bootstrap_token_expires_at,bootstrap_token_consumed_at,created_by_platform_identity_id,created_at,
       external_issuer,external_subject,identity_linked_at,activated_at,cancelled_at)
      VALUES ($1,$2,$3,'FIRST_ADMINISTRATOR','PENDING_IDENTITY',$4,now()+interval '1 hour',NULL,$5,$6,
        NULL,NULL,NULL,NULL,NULL)`,
    [registrationId, tenantId, administratorId, bootstrapTokenHash, reviewerId, createdAt]);

    const accessTokenVerifier = { verify: async (token: string) => {
      if (token !== "verified-access-token") throw new Error("invalid token");
      return { issuer, subject, authenticationMethods: [] };
    } };
    runtime = createPostgresApiRuntime(runtimeEnvironment(), { accessTokenVerifier });
    application = await createApiApplication({ logger: false }, runtime.composition);
    await listen();

    const complete = () => fetch(`${baseUrl}/v1/agency-administrator-bootstrap/completions`, {
      method: "POST",
      headers: { authorization: "Bearer verified-access-token", "content-type": "application/json" },
      body: JSON.stringify({ bootstrapToken }),
    });
    const firstResponse = await complete();
    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json() as Record<string, unknown>;
    expect(firstBody).toMatchObject({ registrationId, tenantId, administratorId, role: "TENANT_ADMINISTRATOR", status: "ACTIVE" });
    expect(firstBody.identityLinkedAt).toEqual(expect.any(String));
    expect(firstBody.activatedAt).toEqual(expect.any(String));

    const firstIdentity = (await ownerPool.query("SELECT status FROM identity.identities WHERE id=$1", [administratorId])).rows[0];
    const firstTenant = (await ownerPool.query("SELECT lifecycle_state, activated_at FROM tenant_management.tenants WHERE id=$1", [tenantId])).rows[0];
    const firstBootstrap = (await ownerPool.query(`SELECT status, tenant_id, internal_identity_id, external_issuer,
      external_subject, bootstrap_token_consumed_at, identity_linked_at, activated_at
      FROM agency_onboarding.agency_registration_administrators WHERE registration_id=$1`, [registrationId])).rows[0];
    expect(firstIdentity).toEqual({ status: "ACTIVE" });
    expect(firstTenant).toMatchObject({ lifecycle_state: "ACTIVE", activated_at: expect.any(Date) });
    expect(firstBootstrap).toMatchObject({
      status: "ACTIVE", tenant_id: tenantId, internal_identity_id: administratorId,
      external_issuer: issuer, external_subject: subject,
      bootstrap_token_consumed_at: expect.any(Date), identity_linked_at: expect.any(Date), activated_at: expect.any(Date),
    });
    expect((await ownerPool.query(`SELECT tenant_id, identity_id, role FROM identity.tenant_memberships
      WHERE tenant_id=$1 AND identity_id=$2`, [tenantId, administratorId])).rows[0])
      .toEqual({ tenant_id: tenantId, identity_id: administratorId, role: "TENANT_ADMINISTRATOR" });
    expect((await ownerPool.query(`SELECT issuer, subject, internal_identity_id, tenant_id FROM identity.external_identities
      WHERE issuer=$1 AND subject=$2`, [issuer, subject])).rows[0])
      .toEqual({ issuer, subject, internal_identity_id: administratorId, tenant_id: tenantId });

    const replayResponse = await complete();
    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toEqual(firstBody);
    expect((await ownerPool.query("SELECT count(*)::int AS count FROM identity.external_identities WHERE internal_identity_id=$1", [administratorId])).rows[0]).toEqual({ count: 1 });
    expect((await ownerPool.query("SELECT count(*)::int AS count FROM identity.tenant_memberships WHERE identity_id=$1", [administratorId])).rows[0]).toEqual({ count: 1 });
    expect((await ownerPool.query("SELECT count(*)::int AS count FROM agency_onboarding.agency_registration_administrators WHERE registration_id=$1", [registrationId])).rows[0]).toEqual({ count: 1 });
    expect((await ownerPool.query("SELECT status FROM identity.identities WHERE id=$1", [administratorId])).rows[0]).toEqual(firstIdentity);
    expect((await ownerPool.query("SELECT lifecycle_state, activated_at FROM tenant_management.tenants WHERE id=$1", [tenantId])).rows[0]).toEqual(firstTenant);
    expect((await ownerPool.query("SELECT status, identity_linked_at, activated_at FROM agency_onboarding.agency_registration_administrators WHERE registration_id=$1", [registrationId])).rows[0])
      .toEqual({ status: firstBootstrap.status, identity_linked_at: firstBootstrap.identity_linked_at, activated_at: firstBootstrap.activated_at });
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

    const authenticatedHeaders = { authorization: "Bearer known-token", "content-type": "application/json" };
    const rootResponse = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: authenticatedHeaders, body: JSON.stringify({
        title: "RÃ©sidence OIDC", propertyType: "HOUSE", transactionType: "SALE",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue OIDC" },
      }),
    });
    expect(rootResponse.status).toBe(201); const root = await rootResponse.json() as { propertyId: string };
    const buildingResponse = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings`, {
      method: "POST", headers: authenticatedHeaders, body: JSON.stringify({ buildingCode: "OIDC-A", name: "Immeuble OIDC" }),
    });
    expect(buildingResponse.status).toBe(201); const building = await buildingResponse.json() as { buildingId: string };
    const unitResponse = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings/${building.buildingId}/units`, {
      method: "POST", headers: authenticatedHeaders, body: JSON.stringify({
        unitCode: "OIDC-101", title: "UnitÃ© OIDC", propertyType: "APARTMENT", transactionType: "SALE",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue OIDC, 101" },
      }),
    });
    expect(unitResponse.status).toBe(201); const oidcUnit = await unitResponse.json() as { property: { propertyId: string } };
    expect((await fetch(`${baseUrl}/v1/properties/${root.propertyId}/details`, {
      method: "PUT", headers: authenticatedHeaders, body: JSON.stringify({
        details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
      }),
    })).status).toBe(200);
    await insertPrimaryPhoto("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", root.propertyId);
    const publication = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/publication`, {
      method: "PUT", headers: { authorization: "Bearer known-token" },
    });
    const publicationBody = await publication.json();
    expect(publication.status, JSON.stringify(publicationBody)).toBe(200);
    expect(publicationBody).toMatchObject({ propertyId: root.propertyId, status: "PUBLISHED" });

    await application.close(); application = undefined;
    await runtime.close(); runtime = undefined;
    runtime = createPostgresApiRuntime(runtimeEnvironment(), { accessTokenVerifier });
    application = await createApiApplication({ logger: false }, runtime.composition);
    await listen();
    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}`, {
      headers: { authorization: "Bearer known-token" },
    })).status).toBe(404);
    const persistedUnit = await fetch(`${baseUrl}/v1/properties/${oidcUnit.property.propertyId}`, {
      headers: { authorization: "Bearer known-token" },
    });
    expect(persistedUnit.status).toBe(200); expect(await persistedUnit.json()).toMatchObject({ structuralRole: "UNIT" });
    expect(await (await fetch(`${baseUrl}/v1/properties/${root.propertyId}`, {
      headers: { authorization: "Bearer known-token" },
    })).json()).toMatchObject({ status: "PUBLISHED", structuralRole: "COMPOSITE" });
  });

  it("persists and retrieves a Property through the real PostgreSQL API composition", async () => {
    await start(); const tenantId = await createTenant("property");
    const created = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "Apartment", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO",
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
    const coreUpdated = await fetch(`${baseUrl}/v1/properties/${property.propertyId}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "Villa Lagune", description: "RÃ©novÃ©e",
        location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" },
      }),
    });
    expect(coreUpdated.status).toBe(200); expect(await coreUpdated.json()).toMatchObject({
      title: "Villa Lagune", description: "RÃ©novÃ©e", propertyType: "APARTMENT",
      transactionType: "LONG_TERM_RENTAL", status: "DRAFT", location: { district: "Marcory" },
    });
    expect((await ownerPool.query("SELECT title, district FROM property_management.properties WHERE property_id = $1", [property.propertyId])).rows[0])
      .toEqual({ title: "Villa Lagune", district: "Marcory" });
    const updated = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/details`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        details: { usableSurfaceSquareMeters: 72, rooms: 3, bedrooms: 2, bathrooms: 1 },
      }),
    });
    expect(updated.status).toBe(200);
    const pricing = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/pricing`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 300_000, rentPeriod: "MONTH",
        securityDepositAmountMinor: 600_000, chargesAmountMinor: 25_000, agencyFeeAmountMinor: 300_000,
      }),
    });
    expect(pricing.status).toBe(200);
    expect(await pricing.json()).toMatchObject({ commercialTerms: {
      kind: "LONG_TERM_RENTAL", rentAmountMinor: 300_000, securityDepositAmountMinor: 600_000,
      chargesAmountMinor: 25_000, agencyFeeAmountMinor: 300_000,
    } });
    const availabilityEndpoint = `${baseUrl}/v1/properties/${property.propertyId}/availability`;
    const initialAvailability = await fetch(availabilityEndpoint);
    expect(initialAvailability.status).toBe(200);
    expect(await initialAvailability.json()).toEqual({
      propertyId: property.propertyId, source: "DIRECT", structuralRole: "STANDALONE",
      configured: false, canUpdateAvailability: true,
    });
    const configuredAvailability = await fetch(availabilityEndpoint, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED" }),
    });
    expect(configuredAvailability.status).toBe(200);
    const configuredAvailabilityBody = await configuredAvailability.json();
    expect(configuredAvailabilityBody).toMatchObject({
      propertyId: property.propertyId, configured: true,
      availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED", updatedAt: expect.any(String),
    });
    const replayedAvailability = await fetch(availabilityEndpoint, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED" }),
    });
    expect(replayedAvailability.status).toBe(200);
    expect(await replayedAvailability.json()).toMatchObject({ updatedAt: configuredAvailabilityBody.updatedAt });
    expect((await ownerPool.query(`SELECT availability_status, occupancy_status,
      availability_updated_at IS NOT NULL AS has_availability_updated_at,
      availability_updated_by_actor_id, availability_correlation_id IS NOT NULL AS has_availability_correlation
      FROM property_management.properties WHERE property_id=$1`, [property.propertyId])).rows[0]).toEqual({
      availability_status: "AVAILABLE", occupancy_status: "OCCUPIED", has_availability_updated_at: true,
      availability_updated_by_actor_id: "runtime-test", has_availability_correlation: true,
    });
    await insertStudioPhotoSet(tenantId, property.propertyId);
    expect((await ownerPool.query(`SELECT commercial_kind, rent_amount_minor, security_deposit_amount_minor,
      charges_amount_minor, agency_fee_amount_minor, pricing_version FROM property_management.properties
      WHERE property_id = $1`, [property.propertyId])).rows[0]).toEqual({
      commercial_kind: "LONG_TERM_RENTAL", rent_amount_minor: "300000",
      security_deposit_amount_minor: "600000", charges_amount_minor: "25000",
      agency_fee_amount_minor: "300000", pricing_version: 2,
    });
    const publication = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/publication`, { method: "PUT" });
    const publicationBody = await publication.json();
    expect(publication.status, JSON.stringify(publicationBody)).toBe(200);
    expect(publicationBody).toMatchObject({ propertyId: property.propertyId, status: "PUBLISHED", publishedAt: expect.any(String) });
    expect((await ownerPool.query(`SELECT status, published_at IS NOT NULL AS has_published_at,
      published_by_actor_id, publication_correlation_id IS NOT NULL AS has_publication_correlation
      FROM property_management.properties WHERE property_id = $1`, [property.propertyId])).rows[0]).toEqual({
      status: "PUBLISHED", has_published_at: true, published_by_actor_id: "runtime-test", has_publication_correlation: true,
    });
    const withdrawal = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/publication`, { method: "DELETE" });
    const withdrawalBody = await withdrawal.json();
    expect(withdrawal.status, JSON.stringify(withdrawalBody)).toBe(200);
    expect(withdrawalBody).toMatchObject({
      propertyId: property.propertyId,
      status: "WITHDRAWN",
      publishedAt: publicationBody.publishedAt,
      withdrawnAt: expect.any(String),
      canWithdrawFromCatalog: false,
      details: { rooms: 3 },
    });
    const persistedWithdrawal = (await ownerPool.query(`SELECT status, withdrawn_at, withdrawn_by_actor_id,
      withdrawal_correlation_id, published_at
      FROM property_management.properties WHERE property_id = $1`, [property.propertyId])).rows[0];
    expect(persistedWithdrawal).toMatchObject({
      status: "WITHDRAWN",
      withdrawn_by_actor_id: "runtime-test",
      withdrawal_correlation_id: expect.any(String),
    });
    const replay = await fetch(`${baseUrl}/v1/properties/${property.propertyId}/publication`, { method: "DELETE" });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ status: "WITHDRAWN", withdrawnAt: withdrawalBody.withdrawnAt });
    const persistedReplay = (await ownerPool.query(`SELECT withdrawn_at, withdrawn_by_actor_id, withdrawal_correlation_id
      FROM property_management.properties WHERE property_id = $1`, [property.propertyId])).rows[0];
    expect(persistedReplay).toEqual({
      withdrawn_at: persistedWithdrawal.withdrawn_at,
      withdrawn_by_actor_id: persistedWithdrawal.withdrawn_by_actor_id,
      withdrawal_correlation_id: persistedWithdrawal.withdrawal_correlation_id,
    });
    const withdrawnPortfolio = await fetch(`${baseUrl}/v1/properties?status=WITHDRAWN`);
    expect(withdrawnPortfolio.status).toBe(200);
    expect(await withdrawnPortfolio.json()).toMatchObject({
      items: [{ propertyId: property.propertyId, status: "WITHDRAWN", withdrawnAt: withdrawalBody.withdrawnAt }],
    });
  });

  it("rÃ©cupÃ¨re les lectures et la gestion photo via le rÃ´le monpiole_runtime migrÃ©", async () => {
    await start(); await createTenant("runtime-photo");
    expect((await runtimePool.query("SELECT current_user")).rows[0]).toEqual({ current_user: "monpiole_runtime" });

    const created = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "Maison avec photos", propertyType: "HOUSE", transactionType: "SALE",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
      }),
    });
    expect(created.status).toBe(201);
    const propertyId = (await created.json() as { propertyId: string }).propertyId;

    const upload = async (category: string) => {
      const response = await fetch(`${baseUrl}/v1/properties/${propertyId}/photos`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          category, contentType: "image/png", contentBase64: "iVBORw0KGgo=",
        }),
      });
      expect(response.status).toBe(201);
      return await response.json() as { photos: { photoId: string; category: string; isPrimary: boolean }[] };
    };
    const firstUpload = await upload("BUILDING_EXTERIOR_OR_ENTRANCE");
    const firstPhotoId = firstUpload.photos[0]!.photoId;
    const secondUpload = await upload("OTHER");
    const secondPhotoId = secondUpload.photos.find((photo) => photo.photoId !== firstPhotoId)!.photoId;

    const property = await fetch(`${baseUrl}/v1/properties/${propertyId}`);
    expect(property.status).toBe(200);
    expect(await property.json()).toMatchObject({
      propertyId,
      photos: expect.arrayContaining([
        expect.objectContaining({ photoId: firstPhotoId }),
        expect.objectContaining({ photoId: secondPhotoId }),
      ]),
    });

    const defaultStandard = await fetch(`${baseUrl}/v1/property-photo-standard`);
    expect(defaultStandard.status).toBe(200);
    expect(await defaultStandard.json()).toEqual({ minimumCount: 1, additionalRequiredCategories: [] });
    const strengthened = await fetch(`${baseUrl}/v1/property-photo-standard`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        minimumCount: 2, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"],
      }),
    });
    expect(strengthened.status).toBe(200);
    expect(await strengthened.json()).toEqual({
      minimumCount: 2, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"],
    });
    expect(await (await fetch(`${baseUrl}/v1/property-photo-standard`)).json()).toEqual({
      minimumCount: 2, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"],
    });

    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}/photos/${firstPhotoId}/primary`, { method: "PUT" })).status).toBe(200);
    expect((await fetch(`${baseUrl}/v1/properties/${propertyId}/photos/${secondPhotoId}`, { method: "DELETE" })).status).toBe(204);
    expect((await ownerPool.query(`SELECT selected_photo_id, actor_id
      FROM property_management.property_primary_photo_audits WHERE property_id = $1`, [propertyId])).rows)
      .toEqual([{ selected_photo_id: firstPhotoId, actor_id: "runtime-test" }]);
  });

  it("exÃ©cute le parcours Property vers Building puis Unit avec dÃ©tails et ownership sur le runtime rÃ©el", async () => {
    await start(); const tenantId = await createTenant("composition");
    const rootResponse = await fetch(`${baseUrl}/v1/properties`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: "RÃ©sidence Lagune", propertyType: "HOUSE", transactionType: "SALE",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins" },
      }),
    });
    expect(rootResponse.status).toBe(201); const root = await rootResponse.json() as { propertyId: string; structuralRole: string };
    expect(root.structuralRole).toBe("STANDALONE");

    const buildingResponse = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buildingCode: "bat-a", name: "Immeuble A" }),
    });
    expect(buildingResponse.status).toBe(201); const building = await buildingResponse.json() as { buildingId: string; buildingCode: string };
    expect(building.buildingCode).toBe("BAT-A");
    expect(await (await fetch(`${baseUrl}/v1/properties/${root.propertyId}`)).json()).toMatchObject({ structuralRole: "COMPOSITE" });

    const unitResponse = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings/${building.buildingId}/units`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        unitCode: "a-101", title: "Appartement A-101", description: "Premier Ã©tage",
        propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO",
        location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins, A-101" },
      }),
    });
    expect(unitResponse.status).toBe(201); const unit = await unitResponse.json() as { unitCode: string; property: { propertyId: string; structuralRole: string } };
    expect(unit).toMatchObject({ unitCode: "A-101", property: { structuralRole: "UNIT" } });
    expect((await ownerPool.query("SELECT tenant_id FROM property_management.property_building_units WHERE unit_property_id=$1", [unit.property.propertyId])).rows[0]?.tenant_id).toBe(tenantId);

    const list = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings/${building.buildingId}/units?limit=1`);
    expect(list.status).toBe(200); expect(await list.json()).toMatchObject({ items: [{ unitCode: "A-101", property: { propertyId: unit.property.propertyId } }] });
    const codeUpdate = await fetch(`${baseUrl}/v1/properties/${root.propertyId}/buildings/${building.buildingId}/units/${unit.property.propertyId}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitCode: "A-102" }),
    });
    expect(codeUpdate.status).toBe(200); expect(await codeUpdate.json()).toMatchObject({ unitCode: "A-102" });

    const details = await fetch(`${baseUrl}/v1/properties/${unit.property.propertyId}/details`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
        details: { rooms: 3, bedrooms: 2 },
        commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH" },
      }),
    });
    expect(details.status).toBe(200); expect(await details.json()).toMatchObject({ structuralRole: "UNIT", details: { rooms: 3 } });

    const ownerResponse = await fetch(`${baseUrl}/v1/property-owners`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerType: "INDIVIDUAL", firstName: "Awa", lastName: "KonÃ©" }),
    });
    expect(ownerResponse.status).toBe(201); const propertyOwner = await ownerResponse.json() as { ownerId: string };
    const assignment = await fetch(`${baseUrl}/v1/properties/${unit.property.propertyId}/owners`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: propertyOwner.ownerId, ownershipShare: 100 }),
    });
    expect(assignment.status).toBe(201);
    expect(await (await fetch(`${baseUrl}/v1/properties/${unit.property.propertyId}/owners`)).json()).toEqual([
      expect.objectContaining({ ownerId: propertyOwner.ownerId, ownershipShare: 100 }),
    ]);
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

  it("composes the activated public catalog with a distinct reader pool", async () => {
    const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const propertyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const client = await ownerPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO property_management.properties
        (property_id,tenant_id,title,description,property_type,transaction_type,status,structural_role,
         country,city,district,address_line,created_at,updated_at,correlation_id,actor_id,published_at,
         published_by_actor_id,publication_correlation_id,usable_surface_square_meters,rooms,
         commercial_kind,currency,sale_price_amount_minor)
        VALUES ($1,$2,'Maison publique','Description publique','HOUSE','SALE','PUBLISHED','STANDALONE',
          'CI','Abidjan','Cocody','Adresse privÃ©e',now(),now(),$3,'publisher',now(),'publisher',$3,
          100,4,'SALE','XOF',125000000)`, [propertyId, tenantId, randomUUID()]);
      await client.query(`INSERT INTO property_management.property_photos
        (photo_id,tenant_id,property_id,category,status,is_primary,content_base64,content_type,
         content_byte_size,content_sha256,registered_at,available_at,media_kind,gallery_position)
        VALUES ($1,$2,$3,'BUILDING_EXTERIOR_OR_ENTRANCE','AVAILABLE',true,'iVBORw0KGgo=','image/png',8,
          '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',now(),now(),'IMAGE',0)`,
      [randomUUID(), tenantId, propertyId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    runtime = createPostgresApiRuntime({
      ...runtimeEnvironment(),
      PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST: `catalogue.runtime.test=${tenantId}`,
      PUBLIC_CATALOG_DATABASE_URL: connectionString("monpiole_public_catalog_reader", "synthetic-public-reader"),
      PUBLIC_CATALOG_DATABASE_TLS: "disabled",
      PUBLIC_CATALOG_DATABASE_POOL_MAX: "2",
    });
    expect(runtime.composition.publicCatalogTenantResolver?.resolve("catalogue.runtime.test")).toBe(tenantId);
    await expect(runtime.composition.listPublicProperties?.execute({ tenantId })).resolves.toMatchObject({
      items: [{ publicPropertyId: propertyId, title: "Maison publique", primaryPhoto: { contentType: "image/png" } }],
    });
    await expect(runtime.composition.retrievePublicProperty?.execute({ tenantId, publicPropertyId: propertyId }))
      .resolves.toMatchObject({ publicPropertyId: propertyId });
    await expect(runtime.composition.retrievePublicPrimaryPhoto?.execute({ tenantId, publicPropertyId: propertyId }))
      .resolves.toMatchObject({ contentType: "image/png" });
    application = await createApiApplication({ logger: false }, {
      ...runtime.composition,
      authenticatedAuthorityProvider: { resolve: async () => ({
        actorId: "runtime-withdrawer",
        authorityId: "runtime-withdrawer",
        grants: ["RETRIEVE_PROPERTY", "LIST_PROPERTIES", "WITHDRAW_PROPERTY_FROM_CATALOG"],
        tenantIds: [tenantId],
      }) },
    });
    await listen();
    const withdrawal = await fetch(`${baseUrl}/v1/properties/${propertyId}/publication`, { method: "DELETE" });
    expect(withdrawal.status).toBe(200);
    expect(await withdrawal.json()).toMatchObject({ status: "WITHDRAWN", canWithdrawFromCatalog: false });
    await expect(runtime.composition.listPublicProperties?.execute({ tenantId })).resolves.toMatchObject({ items: [] });
    await expect(runtime.composition.retrievePublicProperty?.execute({ tenantId, publicPropertyId: propertyId }))
      .rejects.toMatchObject({ code: "PUBLIC_PROPERTY_NOT_FOUND" });
    await expect(runtime.composition.retrievePublicPrimaryPhoto?.execute({ tenantId, publicPropertyId: propertyId }))
      .rejects.toMatchObject({ code: "PUBLIC_PROPERTY_NOT_FOUND" });
    expect(await (await fetch(`${baseUrl}/v1/properties/${propertyId}`)).json()).toMatchObject({
      status: "WITHDRAWN",
      title: "Maison publique",
    });
    const databaseUsers = (await ownerPool.query(`SELECT DISTINCT usename FROM pg_stat_activity
      WHERE datname = current_database() AND usename IN ('monpiole_runtime', 'monpiole_public_catalog_reader')
      ORDER BY usename`)).rows.map((row) => row.usename);
    expect(databaseUsers).toEqual(["monpiole_public_catalog_reader", "monpiole_runtime"]);
  });
});
