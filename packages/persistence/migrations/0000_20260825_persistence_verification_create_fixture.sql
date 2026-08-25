CREATE SCHEMA "persistence_verification";
--> statement-breakpoint
CREATE TABLE "persistence_verification"."tenant_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tenant_records_tenant_id_idx" ON "persistence_verification"."tenant_records" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "persistence_verification"."tenant_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "persistence_verification"."tenant_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_records_tenant_isolation"
ON "persistence_verification"."tenant_records"
USING (
	"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
)
WITH CHECK (
	"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
);
