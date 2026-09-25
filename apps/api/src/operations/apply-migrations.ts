import { fileURLToPath } from "node:url";

import {
  applyPostgresMigrations,
  PostgresPool,
  postgresConfigurationFromEnvironment,
} from "@monpiole/persistence";

const migrationUrl = process.env["DATABASE_MIGRATION_URL"]?.trim();
if (!migrationUrl) throw new Error("DATABASE_MIGRATION_URL is required");

const database = new PostgresPool(postgresConfigurationFromEnvironment({
  ...process.env,
  DATABASE_URL: migrationUrl,
  DATABASE_TLS: process.env["DATABASE_MIGRATION_TLS"],
}));

const repositoryRoot = new URL("../../../../", import.meta.url);
try {
  await applyPostgresMigrations(database.infrastructurePool(), [
    { folder: fileURLToPath(new URL("services/tenant-management/migrations", repositoryRoot)), table: "tenant_management_migrations" },
    { folder: fileURLToPath(new URL("services/identity/migrations", repositoryRoot)), table: "identity_migrations" },
    { folder: fileURLToPath(new URL("services/property-management/migrations", repositoryRoot)), table: "property_management_migrations" },
    { folder: fileURLToPath(new URL("services/agency-onboarding/migrations", repositoryRoot)), table: "agency_onboarding_migrations" },
  ]);
  process.stdout.write("PostgreSQL migrations applied.\n");
} finally {
  await database.close();
}
