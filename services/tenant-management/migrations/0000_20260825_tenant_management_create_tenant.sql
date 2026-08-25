CREATE SCHEMA "tenant_management";
--> statement-breakpoint
CREATE TABLE "tenant_management"."create_tenant_idempotency" (
	"authority_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"normalized_intent" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lifecycle_state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_management"."outbox" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"envelope" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_management"."tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_name" text NOT NULL,
	"responsible_person_name" text NOT NULL,
	"responsible_email" text NOT NULL,
	"responsible_telephone" text NOT NULL,
	"country" text NOT NULL,
	"lifecycle_state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"authority_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "create_tenant_idempotency_authority_key_unique" ON "tenant_management"."create_tenant_idempotency" USING btree ("authority_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "create_tenant_idempotency_tenant_idx" ON "tenant_management"."create_tenant_idempotency" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "outbox_tenant_occurred_idx" ON "tenant_management"."outbox" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_responsible_email_unique" ON "tenant_management"."tenants" USING btree ("responsible_email");
--> statement-breakpoint
ALTER TABLE "tenant_management"."create_tenant_idempotency"
ADD CONSTRAINT "create_tenant_idempotency_tenant_fk"
FOREIGN KEY ("tenant_id") REFERENCES "tenant_management"."tenants"("id");
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox"
ADD CONSTRAINT "outbox_tenant_fk"
FOREIGN KEY ("tenant_id") REFERENCES "tenant_management"."tenants"("id");
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants"
ADD CONSTRAINT "tenants_pending_lifecycle_check" CHECK ("lifecycle_state" = 'PENDING');
--> statement-breakpoint
ALTER TABLE "tenant_management"."create_tenant_idempotency"
ADD CONSTRAINT "create_tenant_idempotency_pending_lifecycle_check" CHECK ("lifecycle_state" = 'PENDING');
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox"
ADD CONSTRAINT "outbox_tenant_created_contract_check"
CHECK ("event_type" = 'monpiole.tenant.tenant-created' AND "event_version" = '1');
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_management"."create_tenant_idempotency" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_management"."create_tenant_idempotency" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenants_create_tenant_platform_authority"
ON "tenant_management"."tenants"
USING (current_setting('app.platform_authority', true) = 'tenant:create')
WITH CHECK (current_setting('app.platform_authority', true) = 'tenant:create');
--> statement-breakpoint
CREATE POLICY "idempotency_create_tenant_platform_authority"
ON "tenant_management"."create_tenant_idempotency"
USING (current_setting('app.platform_authority', true) = 'tenant:create')
WITH CHECK (current_setting('app.platform_authority', true) = 'tenant:create');
--> statement-breakpoint
CREATE POLICY "outbox_create_tenant_platform_authority"
ON "tenant_management"."outbox"
USING (current_setting('app.platform_authority', true) = 'tenant:create')
WITH CHECK (current_setting('app.platform_authority', true) = 'tenant:create');
