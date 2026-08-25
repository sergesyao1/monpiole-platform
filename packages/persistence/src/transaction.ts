import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class PostgresTransactionScope {
  readonly #client: PoolClient;
  readonly #database: NodePgDatabase;

  public constructor(client: PoolClient) {
    this.#client = client;
    this.#database = drizzle(client);
  }

  /** Infrastructure-only escape hatch; never use as an inward-facing port type. */
  public database(): NodePgDatabase {
    return this.#database;
  }

  /** Infrastructure-only parameterized SQL path for PostgreSQL features such as RLS. */
  public async query<Row extends Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<readonly Row[]> {
    const result = await this.#client.query<Row>(text, [...values]);
    return result.rows;
  }
}

export async function withPostgresTransaction<Result>(
  pool: Pool,
  operation: (scope: PostgresTransactionScope) => Promise<Result>,
): Promise<Result> {
  return executeTransaction(pool, undefined, operation);
}

export async function withTenantPostgresTransaction<Result>(
  pool: Pool,
  tenantId: string,
  operation: (scope: PostgresTransactionScope) => Promise<Result>,
): Promise<Result> {
  if (!UUID.test(tenantId)) throw new Error("tenantId must be a valid UUID");
  return executeTransaction(pool, tenantId, operation);
}

async function executeTransaction<Result>(
  pool: Pool,
  tenantId: string | undefined,
  operation: (scope: PostgresTransactionScope) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    if (tenantId !== undefined) {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    }
    const result = await operation(new PostgresTransactionScope(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
