import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ActivateTenant, CreateTenant, DuplicateTenantEmailError, IdempotencyConflictError,
  PostgresActivateTenantUnitOfWork, PostgresCreateTenantUnitOfWork, TenantAdministratorNotReadyError,
} from "../src/index.js";

const POSTGRES_IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;

function connectionString(user: string, password: string): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/tenant_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_DB: "tenant_test", POSTGRES_PASSWORD: OWNER_PASSWORD, POSTGRES_USER: "migration_owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(`CREATE ROLE tenant_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await migrate(drizzle(ownerPool), { migrationsFolder });
  await ownerPool.query("GRANT USAGE ON SCHEMA tenant_management TO tenant_runtime");
  await ownerPool.query("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO tenant_runtime");
  runtimePool = new Pool({ connectionString: connectionString("tenant_runtime", RUNTIME_PASSWORD), max: 4 });
});

afterEach(async () => {
  await ownerPool.query("TRUNCATE tenant_management.outbox, tenant_management.create_tenant_idempotency, tenant_management.tenants CASCADE");
});
afterAll(async () => { await runtimePool?.end(); await ownerPool?.end(); await container?.stop(); });

function command(key: string, email = "owner@example.invalid", organizationName = "Agency") {
  return { organizationName, responsiblePersonName: "Ada Example", responsibleEmail: email,
    responsibleTelephone: "+2250102030405", country: "CI",
    authority: { actorId: "actor-1", authorityId: "platform-admin", grants: ["CREATE_TENANT", "ACTIVATE_TENANT"] as const, tenantIds: [] },
    correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", idempotencyKey: key };
}

function createUseCase(eventId: () => string = () => randomUUID()) {
  return new CreateTenant(
    { authorizeCreateTenant: async () => true }, new PostgresCreateTenantUnitOfWork(runtimePool),
    { generate: () => randomUUID() }, { generate: eventId }, { now: () => "2026-08-25T12:00:00.000Z" },
  );
}

async function counts() {
  const result = await ownerPool.query<{ tenants: string; idempotency: string; outbox: string }>(`
    SELECT (SELECT count(*) FROM tenant_management.tenants)::text AS tenants,
      (SELECT count(*) FROM tenant_management.create_tenant_idempotency)::text AS idempotency,
      (SELECT count(*) FROM tenant_management.outbox)::text AS outbox`);
  return result.rows[0];
}

describe("Create Tenant PostgreSQL adapter", () => {
  it("atomically creates tenant, idempotency, and Outbox records", async () => {
    const result = await createUseCase().execute(command("key-1"));
    expect(result.lifecycleState).toBe("PENDING");
    expect(await counts()).toEqual({ tenants: "1", idempotency: "1", outbox: "1" });
    const outbox = await ownerPool.query<{ envelope: Record<string, unknown> }>("SELECT envelope FROM tenant_management.outbox");
    expect(outbox.rows[0]?.envelope).toMatchObject({ eventType: "monpiole.tenant.tenant-created", eventVersion: 1,
      tenantId: result.tenantId, correlationId: command("key-1").correlationId,
      payload: { tenantId: result.tenantId, lifecycleState: "PENDING" } });
  });

  it("returns the persisted result without duplicate rows for an idempotent replay", async () => {
    const useCase = createUseCase(); const first = await useCase.execute(command("key-replay"));
    await expect(useCase.execute(command("key-replay"))).resolves.toEqual(first);
    expect(await counts()).toEqual({ tenants: "1", idempotency: "1", outbox: "1" });
  });

  it("rejects a different intent under the same key", async () => {
    const useCase = createUseCase(); await useCase.execute(command("key-conflict"));
    await expect(useCase.execute(command("key-conflict", "other@example.invalid"))).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await counts()).toEqual({ tenants: "1", idempotency: "1", outbox: "1" });
  });

  it("uses database uniqueness as concurrent duplicate-email protection", async () => {
    const useCase = createUseCase();
    const settled = await Promise.allSettled([useCase.execute(command("duplicate-a")), useCase.execute(command("duplicate-b"))]);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((item) => item.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(DuplicateTenantEmailError);
    expect(await counts()).toEqual({ tenants: "1", idempotency: "1", outbox: "1" });
  });

  it("serializes concurrent use of the same idempotency key", async () => {
    const useCase = createUseCase();
    const [first, second] = await Promise.all([useCase.execute(command("same-key")), useCase.execute(command("same-key"))]);
    expect(second).toEqual(first);
    expect(await counts()).toEqual({ tenants: "1", idempotency: "1", outbox: "1" });
  });

  it("rolls back tenant and idempotency when Outbox contract creation fails", async () => {
    await expect(createUseCase(() => "not-an-event-id").execute(command("rollback"))).rejects.toThrow();
    expect(await counts()).toEqual({ tenants: "0", idempotency: "0", outbox: "0" });
  });

  it("fails closed outside the capability-specific platform-authority transaction", async () => {
    expect((await runtimePool.query("SELECT * FROM tenant_management.tenants")).rows).toHaveLength(0);
    await expect(runtimePool.query(`INSERT INTO tenant_management.tenants
      (id, organization_name, responsible_person_name, responsible_email, responsible_telephone, country,
       lifecycle_state, created_at, correlation_id, actor_id, authority_id)
      VALUES ($1, 'Agency', 'Ada', 'blocked@example.invalid', '+2250102030405', 'CI', 'PENDING', now(), $2, 'actor', 'authority')`,
      [randomUUID(), randomUUID()])).rejects.toMatchObject({ code: "42501" });
  });
});

describe("Activate Tenant PostgreSQL adapter", () => {
  async function pendingTenant() {
    return createUseCase().execute(command("activation-key", "activation@example.invalid"));
  }

  function activationUseCase(eventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", ready = true) {
    return new ActivateTenant(
      new PostgresActivateTenantUnitOfWork(runtimePool),
      { hasActiveTenantAdministrator: async () => ready },
      { generate: () => eventId }, { now: () => "2026-08-25T14:00:00.000Z" },
      { authorizeActivateTenant: async () => true },
    );
  }

  it("atomically updates lifecycle state and records TenantActivated once", async () => {
    const created = await pendingTenant();
    const activate = activationUseCase();
    await expect(activate.execute({ tenantId: created.tenantId, correlationId: command("x").correlationId, authority: { ...command("x").authority, tenantIds: [created.tenantId] } }))
      .resolves.toEqual({ tenantId: created.tenantId, lifecycleState: "ACTIVE", activatedAt: "2026-08-25T14:00:00.000Z" });
    await expect(activate.execute({ tenantId: created.tenantId, correlationId: command("x").correlationId, authority: { ...command("x").authority, tenantIds: [created.tenantId] } }))
      .resolves.toMatchObject({ lifecycleState: "ACTIVE", activatedAt: "2026-08-25T14:00:00.000Z" });
    const tenant = await ownerPool.query("SELECT lifecycle_state, activated_at FROM tenant_management.tenants WHERE id = $1", [created.tenantId]);
    expect(tenant.rows[0]).toMatchObject({ lifecycle_state: "ACTIVE" });
    expect(new Date(tenant.rows[0].activated_at).toISOString()).toBe("2026-08-25T14:00:00.000Z");
    const events = await ownerPool.query<{ event_type: string; envelope: Record<string, unknown> }>(
      "SELECT event_type, envelope FROM tenant_management.outbox WHERE event_type = 'monpiole.tenant.tenant-activated'",
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.envelope).toMatchObject({
      eventType: "monpiole.tenant.tenant-activated", tenantId: created.tenantId,
      payload: { lifecycleState: "ACTIVE", activatedAt: "2026-08-25T14:00:00.000Z" },
    });
  });

  it("rolls back ACTIVE and TenantActivated when event serialization fails", async () => {
    const created = await pendingTenant();
    await expect(activationUseCase("invalid-event-id").execute({
      tenantId: created.tenantId, correlationId: command("x").correlationId, authority: { ...command("x").authority, tenantIds: [created.tenantId] },
    })).rejects.toThrow();
    const tenant = await ownerPool.query("SELECT lifecycle_state, activated_at FROM tenant_management.tenants WHERE id = $1", [created.tenantId]);
    expect(tenant.rows[0]).toEqual({ lifecycle_state: "PENDING", activated_at: null });
    const events = await ownerPool.query("SELECT * FROM tenant_management.outbox WHERE event_type = 'monpiole.tenant.tenant-activated'");
    expect(events.rows).toHaveLength(0);
  });

  it("does not mutate a tenant while its administrator is not ready", async () => {
    const created = await pendingTenant();
    await expect(activationUseCase(undefined, false).execute({
      tenantId: created.tenantId, correlationId: command("x").correlationId, authority: { ...command("x").authority, tenantIds: [created.tenantId] },
    })).rejects.toBeInstanceOf(TenantAdministratorNotReadyError);
    const tenant = await ownerPool.query("SELECT lifecycle_state FROM tenant_management.tenants WHERE id = $1", [created.tenantId]);
    expect(tenant.rows[0]?.lifecycle_state).toBe("PENDING");
  });

  it("keeps the activation capability tenant-scoped", async () => {
    const first = await pendingTenant();
    const second = await createUseCase().execute(command("activation-key-2", "second-activation@example.invalid"));
    await new PostgresActivateTenantUnitOfWork(runtimePool).execute(first.tenantId, async (transaction) => {
      await expect(transaction.findTenantForUpdate(second.tenantId)).resolves.toBeUndefined();
    });
  });
});
