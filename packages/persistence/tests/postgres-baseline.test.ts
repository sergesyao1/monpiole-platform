import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresPool } from "../src/pool.js";
import {
  withPostgresTransaction,
  withTenantPostgresTransaction,
} from "../src/transaction.js";
import { tenantRecords } from "../src/verification-schema.js";
import { SyntheticVerificationRepository } from "./verification-repository.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const verificationRepository = new SyntheticVerificationRepository();

let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;
let managedRuntimePool: PostgresPool;

function connectionString(user: string, password: string): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/persistence_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "persistence_test",
      POSTGRES_PASSWORD: OWNER_PASSWORD,
      POSTGRES_USER: "migration_owner",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(
    `CREATE ROLE persistence_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
  );
  await migrate(drizzle(ownerPool), { migrationsFolder });
  await ownerPool.query("GRANT USAGE ON SCHEMA persistence_verification TO persistence_runtime");
  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE, DELETE ON persistence_verification.tenant_records TO persistence_runtime",
  );

  managedRuntimePool = new PostgresPool({
    connectionString: connectionString("persistence_runtime", RUNTIME_PASSWORD),
    connectionTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 30_000,
    maximumPoolSize: 1,
    tls: false,
  });
  runtimePool = managedRuntimePool.infrastructurePool();
  await managedRuntimePool.readiness();
});

afterAll(async () => {
  await managedRuntimePool?.close();
  await ownerPool?.end();
  await container?.stop();
});

describe("TD-008 PostgreSQL persistence baseline", () => {
  it("runs PostgreSQL 18.6 and applies the Drizzle migration exactly once", async () => {
    const version = await ownerPool.query<{ server_version: string }>("SHOW server_version");
    expect(version.rows[0]?.server_version).toBe("18.6 (Debian 18.6-1.pgdg13+2)");
    const migrations = await ownerPool.query<{ count: string }>(
      "SELECT count(*) FROM drizzle.__drizzle_migrations",
    );
    expect(migrations.rows[0]?.count).toBe("1");
    await migrate(drizzle(ownerPool), { migrationsFolder });
    const reapplied = await ownerPool.query<{ count: string }>(
      "SELECT count(*) FROM drizzle.__drizzle_migrations",
    );
    expect(reapplied.rows[0]?.count).toBe("1");
  });

  it("uses READ COMMITTED and commits a Drizzle parameterized insert", async () => {
    const id = randomUUID();
    await withTenantPostgresTransaction(runtimePool, TENANT_A, async (scope) => {
      const isolation = await scope.query<{ isolation: string }>(
        "SELECT current_setting('transaction_isolation') AS isolation",
      );
      expect(isolation[0]?.isolation).toBe("read committed");
      await scope.database().insert(tenantRecords).values({ id, tenantId: TENANT_A, value: "committed" });
    });
    const rows = await withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      scope.database().select().from(tenantRecords).where(eq(tenantRecords.id, id))
    );
    expect(rows).toHaveLength(1);
  });

  it("rolls back the complete callback transaction", async () => {
    const id = randomUUID();
    await expect(withTenantPostgresTransaction(runtimePool, TENANT_A, async (scope) => {
      await scope.database().insert(tenantRecords).values({ id, tenantId: TENANT_A, value: "rollback" });
      throw new Error("synthetic failure");
    })).rejects.toThrow("synthetic failure");
    const rows = await withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      scope.database().select().from(tenantRecords).where(eq(tenantRecords.id, id))
    );
    expect(rows).toHaveLength(0);
  });

  it("combines explicit tenant predicates with forced RLS for reads and mutations", async () => {
    const tenantBId = randomUUID();
    await withTenantPostgresTransaction(runtimePool, TENANT_B, (scope) =>
      scope.database().insert(tenantRecords).values({
        id: tenantBId, tenantId: TENANT_B, value: "tenant-b-secret",
      })
    );

    const visible = await withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      verificationRepository.findAll(scope, TENANT_A)
    );
    expect(visible.every((row) => row.tenantId === TENANT_A)).toBe(true);

    const crossTenantRead = await withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      scope.database().select().from(tenantRecords).where(eq(tenantRecords.id, tenantBId))
    );
    expect(crossTenantRead).toHaveLength(0);

    const crossTenantUpdate = await withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      scope.database().update(tenantRecords).set({ value: "stolen" }).where(eq(tenantRecords.id, tenantBId)).returning()
    );
    expect(crossTenantUpdate).toHaveLength(0);
    await expect(withTenantPostgresTransaction(runtimePool, TENANT_A, (scope) =>
      scope.database().insert(tenantRecords).values({ id: randomUUID(), tenantId: TENANT_B, value: "forbidden" })
    )).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it("fails closed without tenant context and rejects invalid context before SQL", async () => {
    const rows = await withPostgresTransaction(runtimePool, (scope) =>
      scope.database().select().from(tenantRecords)
    );
    expect(rows).toHaveLength(0);
    await expect(withPostgresTransaction(runtimePool, (scope) =>
      scope.database().insert(tenantRecords).values({
        id: randomUUID(), tenantId: TENANT_A, value: "missing-context",
      })
    )).rejects.toMatchObject({ cause: { code: "42501" } });
    await expect(withTenantPostgresTransaction(runtimePool, "not-a-uuid", async () => undefined))
      .rejects.toThrow("tenantId must be a valid UUID");
  });

  it("does not leak transaction-local tenant identity through a reused pooled connection", async () => {
    const firstPid = await withTenantPostgresTransaction(runtimePool, TENANT_A, async (scope) => {
      const setting = await scope.query<{ tenant_id: string }>(
        "SELECT current_setting('app.tenant_id', true) AS tenant_id",
      );
      expect(setting[0]?.tenant_id).toBe(TENANT_A);
      return (await scope.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"))[0]?.pid;
    });
    const client = await runtimePool.connect();
    try {
      const reused = await client.query<{ pid: number; tenant_id: string | null }>(
        "SELECT pg_backend_pid() AS pid, current_setting('app.tenant_id', true) AS tenant_id",
      );
      expect(reused.rows[0]?.pid).toBe(firstPid);
      expect(reused.rows[0]?.tenant_id ?? "").toBe("");
    } finally {
      client.release();
    }
  });

  it("uses a non-owner runtime role that cannot bypass forced RLS", async () => {
    const role = await ownerPool.query<{
      rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolbypassrls: boolean;
    }>("SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = 'persistence_runtime'");
    expect(role.rows[0]).toEqual({
      rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false,
    });
    const ownership = await ownerPool.query<{ is_owner: boolean; rls: boolean; force_rls: boolean }>(
      `SELECT c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'persistence_runtime') AS is_owner,
              c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'persistence_verification' AND c.relname = 'tenant_records'`,
    );
    expect(ownership.rows[0]).toEqual({ is_owner: false, rls: true, force_rls: true });
  });
});
