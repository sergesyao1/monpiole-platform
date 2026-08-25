import { index, pgSchema, text, uuid } from "drizzle-orm/pg-core";

/** Synthetic TD-008 verification fixture. This is not a product model. */
export const persistenceVerification = pgSchema("persistence_verification");

export const tenantRecords = persistenceVerification.table(
  "tenant_records",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("tenant_records_tenant_id_idx").on(table.tenantId)],
);
