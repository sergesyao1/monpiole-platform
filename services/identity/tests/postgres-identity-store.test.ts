import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ActivateTenantAdministrator, BootstrapAdministratorConflictError,
  BootstrapTenantAdministrator, PostgresIdentityStore, TenantAdministratorNotFoundError,
} from "../src/index.js";

const POSTGRES_IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ADMIN_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const AUTHORITY = { actorId: "actor-1", authorityId: "authority-1", grants: ["BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR"] as const, tenantIds: [TENANT_A, TENANT_B] };
const AUTHORIZER = { authorize: async () => true };

let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;

function connectionString(user: string, password: string): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/identity_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_DB: "identity_test", POSTGRES_PASSWORD: OWNER_PASSWORD, POSTGRES_USER: "migration_owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(`CREATE ROLE identity_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await migrate(drizzle(ownerPool), { migrationsFolder });
  await ownerPool.query("GRANT USAGE ON SCHEMA identity TO identity_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO identity_runtime");
  runtimePool = new Pool({ connectionString: connectionString("identity_runtime", RUNTIME_PASSWORD), max: 4 });
});

afterEach(async () => {
  await ownerPool.query("TRUNCATE identity.tenant_memberships, identity.identities CASCADE");
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

function bootstrap(store: PostgresIdentityStore, tenantId = TENANT_A, administratorId = ADMIN_A) {
  return new BootstrapTenantAdministrator(
    { exists: async () => true }, store, { generate: () => administratorId }, AUTHORIZER,
  ).execute({
    tenantId, email: "Admin@Example.com", firstName: "Alice", lastName: "Admin", correlationId: CORRELATION_ID, authority: AUTHORITY,
  });
}

describe("Identity PostgreSQL persistence", () => {
  it("persists bootstrap identity and membership atomically in PENDING_ACTIVATION", async () => {
    const result = await bootstrap(new PostgresIdentityStore(runtimePool));
    expect(result).toMatchObject({ tenantId: TENANT_A, administratorId: ADMIN_A, status: "PENDING_ACTIVATION" });
    const identity = await ownerPool.query("SELECT tenant_id, id, email, status FROM identity.identities");
    expect(identity.rows).toEqual([{
      tenant_id: TENANT_A, id: ADMIN_A, email: "admin@example.com", status: "PENDING_ACTIVATION",
    }]);
    const membership = await ownerPool.query("SELECT tenant_id, identity_id, role FROM identity.tenant_memberships");
    expect(membership.rows).toEqual([{
      tenant_id: TENANT_A, identity_id: ADMIN_A, role: "TENANT_ADMINISTRATOR",
    }]);
  });

  it("rehydrates the same domain state through a fresh store instance", async () => {
    await bootstrap(new PostgresIdentityStore(runtimePool));
    const reloaded = await new PostgresIdentityStore(runtimePool).findIdentityById(ADMIN_A, TENANT_A);
    expect(reloaded).toMatchObject({
      id: ADMIN_A, email: "admin@example.com", firstName: "Alice", lastName: "Admin", status: "PENDING_ACTIVATION",
    });
  });

  it("persists ACTIVE and reloads it through another store instance", async () => {
    await bootstrap(new PostgresIdentityStore(runtimePool));
    await new ActivateTenantAdministrator(new PostgresIdentityStore(runtimePool), AUTHORIZER).execute({
      tenantId: TENANT_A, administratorId: ADMIN_A, correlationId: CORRELATION_ID, authority: AUTHORITY,
    });
    const reloaded = await new PostgresIdentityStore(runtimePool).findIdentityById(ADMIN_A, TENANT_A);
    expect(reloaded?.status).toBe("ACTIVE");
    expect((await ownerPool.query("SELECT status FROM identity.identities")).rows[0]?.status).toBe("ACTIVE");
  });

  it("translates database uniqueness into the existing bootstrap conflict", async () => {
    const firstStore = new PostgresIdentityStore(runtimePool);
    await bootstrap(firstStore);
    await expect(bootstrap(new PostgresIdentityStore(runtimePool), TENANT_B, ADMIN_B))
      .rejects.toBeInstanceOf(BootstrapAdministratorConflictError);
    expect((await ownerPool.query("SELECT count(*)::text AS count FROM identity.identities")).rows[0]?.count).toBe("1");
    expect((await ownerPool.query("SELECT count(*)::text AS count FROM identity.tenant_memberships")).rows[0]?.count).toBe("1");
  });

  it("prevents cross-tenant resolution and activation", async () => {
    const store = new PostgresIdentityStore(runtimePool);
    await bootstrap(store);
    await expect(new PostgresIdentityStore(runtimePool).findIdentityById(ADMIN_A, TENANT_B)).resolves.toBeUndefined();
    await expect(new ActivateTenantAdministrator(new PostgresIdentityStore(runtimePool), AUTHORIZER).execute({
      tenantId: TENANT_B, administratorId: ADMIN_A, correlationId: CORRELATION_ID, authority: AUTHORITY,
    })).rejects.toBeInstanceOf(TenantAdministratorNotFoundError);
    expect((await ownerPool.query("SELECT status FROM identity.identities WHERE id = $1", [ADMIN_A])).rows[0]?.status)
      .toBe("PENDING_ACTIVATION");
    expect((await runtimePool.query("SELECT * FROM identity.identities")).rows).toHaveLength(0);
  });
});
