import { foreignKey, pgSchema, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const identitySchema = pgSchema("identity");

export const identities = identitySchema.table("identities", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  status: text("status").notNull(),
  correlationId: uuid("correlation_id").notNull(),
}, (table) => [
  uniqueIndex("identities_email_unique").on(table.email),
  uniqueIndex("identities_id_tenant_unique").on(table.id, table.tenantId),
]);

export const tenantMemberships = identitySchema.table("tenant_memberships", {
  tenantId: uuid("tenant_id").primaryKey(),
  identityId: uuid("identity_id").notNull(),
  role: text("role").notNull(),
  correlationId: uuid("correlation_id").notNull(),
}, (table) => [
  uniqueIndex("tenant_memberships_identity_unique").on(table.identityId),
  foreignKey({
    name: "tenant_memberships_identity_tenant_fk",
    columns: [table.identityId, table.tenantId],
    foreignColumns: [identities.id, identities.tenantId],
  }),
]);
