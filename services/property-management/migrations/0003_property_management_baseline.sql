CREATE TABLE "property_management"."property_ownerships" (
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"ownership_share" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_ownerships_pkey" PRIMARY KEY("tenant_id","property_id","owner_id")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_ownerships" ADD CONSTRAINT "property_ownerships_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_ownerships" ADD CONSTRAINT "property_ownerships_owner_tenant_fk" FOREIGN KEY ("tenant_id","owner_id") REFERENCES "property_management"."property_owners"("tenant_id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_ownerships_tenant_owner_idx" ON "property_management"."property_ownerships" USING btree ("tenant_id","owner_id");
--> statement-breakpoint
ALTER TABLE "property_management"."property_ownerships" ADD CONSTRAINT "property_ownerships_share_check"
CHECK ("ownership_share" > 0 AND "ownership_share" <= 100);
--> statement-breakpoint
ALTER TABLE "property_management"."property_ownerships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_ownerships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "property_ownerships_tenant_isolation" ON "property_management"."property_ownerships"
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
