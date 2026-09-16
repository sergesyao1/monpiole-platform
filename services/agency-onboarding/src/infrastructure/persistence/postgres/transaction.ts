import {
  PostgresTransactionScope,
  withPostgresTransaction,
} from "@monpiole/persistence";
import type { Pool } from "pg";

export type AgencyOnboardingDatabaseCapability =
  | "submit"
  | "retrieve"
  | "review"
  | "decide";

const CAPABILITIES = Object.freeze({
  submit: "agency-registration:submit",
  retrieve: "agency-registration:retrieve",
  review: "agency-registration:review",
  decide: "agency-registration:decide",
} satisfies Record<AgencyOnboardingDatabaseCapability, string>);

export async function withAgencyOnboardingPostgresTransaction<Result>(
  pool: Pool,
  capability: AgencyOnboardingDatabaseCapability,
  operation: (scope: PostgresTransactionScope) => Promise<Result>,
): Promise<Result> {
  return withPostgresTransaction(pool, async (scope) => {
    await scope.query(
      "SELECT set_config('app.platform_capability', $1, true)",
      [CAPABILITIES[capability]],
    );

    return operation(scope);
  });
}