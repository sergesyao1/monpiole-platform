import { pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const propertyManagement = pgSchema("property_management");
export const properties = propertyManagement.table("properties", {
  propertyId: uuid("property_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  title: text("title").notNull(), description: text("description"),
  propertyType: text("property_type").notNull(), transactionType: text("transaction_type").notNull(),
  status: text("status").notNull(), country: text("country").notNull(), city: text("city").notNull(),
  district: text("district").notNull(), addressLine: text("address_line").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  uniqueIndex("properties_tenant_property_unique").on(table.tenantId, table.propertyId),
]);
