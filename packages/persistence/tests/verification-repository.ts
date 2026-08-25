import { eq } from "drizzle-orm";
import type { PostgresTransactionScope } from "../src/transaction.js";
import { tenantRecords } from "../src/verification-schema.js";

export interface SyntheticRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly value: string;
}

/** Test-only adapter proving explicit tenant predicates and row mapping. */
export class SyntheticVerificationRepository {
  public async findAll(
    scope: PostgresTransactionScope,
    tenantId: string,
  ): Promise<readonly SyntheticRecord[]> {
    const rows = await scope.database().select().from(tenantRecords)
      .where(eq(tenantRecords.tenantId, tenantId));
    return rows.map((row) => ({ id: row.id, tenantId: row.tenantId, value: row.value }));
  }
}
