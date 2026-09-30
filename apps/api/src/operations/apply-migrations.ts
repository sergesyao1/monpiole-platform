import { fileURLToPath } from "node:url";

import {
  applyPostgresMigrations,
  PostgresPool,
  postgresConfigurationFromEnvironment,
} from "@monpiole/persistence";

import { migrationTargets } from "./migration-targets.js";

const migrationUrl = process.env["DATABASE_MIGRATION_URL"]?.trim();
if (!migrationUrl) throw new Error("DATABASE_MIGRATION_URL is required");

const database = new PostgresPool(postgresConfigurationFromEnvironment({
  ...process.env,
  DATABASE_URL: migrationUrl,
  DATABASE_TLS: process.env["DATABASE_MIGRATION_TLS"],
}));

const repositoryRoot = new URL("../../../../", import.meta.url);
try {
  await applyPostgresMigrations(database.infrastructurePool(), migrationTargets.map(({ folder, table }) => ({
    folder: fileURLToPath(new URL(folder, repositoryRoot)), table,
  })));
  process.stdout.write("PostgreSQL migrations applied.\n");
} finally {
  await database.close();
}
