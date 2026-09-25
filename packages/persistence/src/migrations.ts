import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

export interface PostgresMigrationSet {
  readonly folder: string;
  readonly table: string;
}

export async function applyPostgresMigrations(
  pool: Pool,
  migrationSets: readonly PostgresMigrationSet[],
): Promise<void> {
  const database = drizzle(pool);
  for (const migrationSet of migrationSets) {
    await migrate(database, {
      migrationsFolder: migrationSet.folder,
      migrationsTable: migrationSet.table,
    });
  }
}
