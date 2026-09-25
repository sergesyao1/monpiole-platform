import { index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const tenantManagement = pgSchema("tenant_management");

export const tenants = tenantManagement.table("tenants", {
  id: uuid("id").primaryKey(),
  organizationName: text("organization_name").notNull(),
  responsiblePersonName: text("responsible_person_name").notNull(),
  responsibleEmail: text("responsible_email").notNull(),
  responsibleTelephone: text("responsible_telephone").notNull(),
  country: text("country").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true, mode: "string" }),
  correlationId: uuid("correlation_id").notNull(),
  actorId: text("actor_id").notNull(),
  authorityId: text("authority_id").notNull(),
}, (table) => [uniqueIndex("tenants_responsible_email_unique").on(table.responsibleEmail)]);

export const createTenantIdempotency = tenantManagement.table("create_tenant_idempotency", {
  authorityId: text("authority_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  normalizedIntent: text("normalized_intent").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(),
  actorId: text("actor_id").notNull(),
}, (table) => [
  uniqueIndex("create_tenant_idempotency_authority_key_unique").on(table.authorityId, table.idempotencyKey),
  index("create_tenant_idempotency_tenant_idx").on(table.tenantId),
]);

export const tenantOutbox = tenantManagement.table("outbox", {
  eventId: uuid("event_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  eventType: text("event_type").notNull(),
  eventVersion: text("event_version").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(),
  envelope: jsonb("envelope").notNull(),
}, (table) => [index("outbox_tenant_occurred_idx").on(table.tenantId, table.occurredAt)]);
