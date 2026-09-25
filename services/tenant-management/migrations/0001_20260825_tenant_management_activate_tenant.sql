ALTER TABLE "tenant_management"."tenants" ADD COLUMN "activated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants" DROP CONSTRAINT "tenants_pending_lifecycle_check";
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants" ADD CONSTRAINT "tenants_lifecycle_check"
CHECK ("lifecycle_state" IN ('PENDING', 'ACTIVE'));
--> statement-breakpoint
ALTER TABLE "tenant_management"."tenants" ADD CONSTRAINT "tenants_activation_timestamp_check"
CHECK (("lifecycle_state" = 'PENDING' AND "activated_at" IS NULL)
  OR ("lifecycle_state" = 'ACTIVE' AND "activated_at" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox" DROP CONSTRAINT "outbox_tenant_created_contract_check";
--> statement-breakpoint
ALTER TABLE "tenant_management"."outbox" ADD CONSTRAINT "outbox_tenant_lifecycle_contract_check"
CHECK (("event_type" = 'monpiole.tenant.tenant-created' AND "event_version" = '1')
  OR ("event_type" = 'monpiole.tenant.tenant-activated' AND "event_version" = '1'));
--> statement-breakpoint
CREATE POLICY "tenants_activate_tenant_capability"
ON "tenant_management"."tenants"
USING (current_setting('app.tenant_capability', true) = 'tenant:activate'
  AND "id"::text = current_setting('app.tenant_id', true))
WITH CHECK (current_setting('app.tenant_capability', true) = 'tenant:activate'
  AND "id"::text = current_setting('app.tenant_id', true));
--> statement-breakpoint
CREATE POLICY "outbox_activate_tenant_capability"
ON "tenant_management"."outbox"
USING (current_setting('app.tenant_capability', true) = 'tenant:activate'
  AND "tenant_id"::text = current_setting('app.tenant_id', true))
WITH CHECK (current_setting('app.tenant_capability', true) = 'tenant:activate'
  AND "tenant_id"::text = current_setting('app.tenant_id', true));
