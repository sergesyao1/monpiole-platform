CREATE TABLE "tenant_management"."organization_tenant_provisioning_idempotency" (
	"authority_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"normalized_intent" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"lifecycle_state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_tenant_provisioning_idempotency_authority_key_unique" ON "tenant_management"."organization_tenant_provisioning_idempotency" USING btree ("authority_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "organization_tenant_provisioning_idempotency_tenant_idx" ON "tenant_management"."organization_tenant_provisioning_idempotency" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "organization_tenant_provisioning_idempotency_organization_idx" ON "tenant_management"."organization_tenant_provisioning_idempotency" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "tenant_management"."organization_tenant_provisioning_idempotency"
ADD CONSTRAINT "organization_tenant_provisioning_idempotency_tenant_fk"
FOREIGN KEY ("tenant_id")
REFERENCES "tenant_management"."tenants"("id");

--> statement-breakpoint
ALTER TABLE "tenant_management"."organization_tenant_provisioning_idempotency"
ADD CONSTRAINT "organization_tenant_provisioning_idempotency_organization_fk"
FOREIGN KEY ("organization_id")
REFERENCES "tenant_management"."organizations"("id");

--> statement-breakpoint
ALTER TABLE "tenant_management"."organization_tenant_provisioning_idempotency"
ADD CONSTRAINT "organization_tenant_provisioning_idempotency_pending_lifecycle_check"
CHECK ("lifecycle_state" = 'PENDING');

--> statement-breakpoint
ALTER TABLE "tenant_management"."organization_tenant_provisioning_idempotency"
ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "tenant_management"."organization_tenant_provisioning_idempotency"
FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "organization_tenant_provisioning_idempotency_create_platform_authority"
ON "tenant_management"."organization_tenant_provisioning_idempotency"
FOR ALL
USING (
    current_setting('app.platform_authority', true) = 'tenant:create'
)
WITH CHECK (
    current_setting('app.platform_authority', true) = 'tenant:create'
);
