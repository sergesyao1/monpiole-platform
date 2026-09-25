import { foreignKey, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

export const externalIdentities = identitySchema.table("external_identities", {
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  internalIdentityId: uuid("internal_identity_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  uniqueIndex("external_identities_issuer_subject_unique").on(table.issuer, table.subject),
  foreignKey({
    name: "external_identities_internal_identity_tenant_fk",
    columns: [table.internalIdentityId, table.tenantId],
    foreignColumns: [identities.id, identities.tenantId],
  }),
]);
