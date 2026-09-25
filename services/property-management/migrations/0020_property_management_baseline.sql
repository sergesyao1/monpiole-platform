CREATE TABLE "property_management"."property_viewings" (
	"viewing_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"status" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "property_viewings_time_check" CHECK ("property_management"."property_viewings"."ends_at">"property_management"."property_viewings"."starts_at" AND "property_management"."property_viewings"."ends_at"<="property_management"."property_viewings"."starts_at"+interval '4 hours' AND char_length(btrim("property_management"."property_viewings"."time_zone")) BETWEEN 1 AND 100),
	CONSTRAINT "property_viewings_lifecycle_check" CHECK (("property_management"."property_viewings"."status"='SCHEDULED' AND "property_management"."property_viewings"."completed_at" IS NULL AND "property_management"."property_viewings"."cancelled_at" IS NULL) OR ("property_management"."property_viewings"."status"='COMPLETED' AND "property_management"."property_viewings"."completed_at" IS NOT NULL AND "property_management"."property_viewings"."cancelled_at" IS NULL) OR ("property_management"."property_viewings"."status"='CANCELLED' AND "property_management"."property_viewings"."cancelled_at" IS NOT NULL AND "property_management"."property_viewings"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_viewings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_viewings" ADD CONSTRAINT "property_viewings_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_viewings" ADD CONSTRAINT "property_viewings_inquiry_tenant_fk" FOREIGN KEY ("tenant_id","inquiry_id") REFERENCES "property_management"."property_inquiries"("tenant_id","inquiry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_viewings_tenant_viewing_unique" ON "property_management"."property_viewings" USING btree ("tenant_id","viewing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_viewings_tenant_inquiry_unique" ON "property_management"."property_viewings" USING btree ("tenant_id","inquiry_id");--> statement-breakpoint
CREATE INDEX "property_viewings_tenant_property_time_idx" ON "property_management"."property_viewings" USING btree ("tenant_id","property_id","starts_at","viewing_id");--> statement-breakpoint
CREATE POLICY "property_viewings_tenant_isolation" ON "property_management"."property_viewings" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_viewings"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("property_management"."property_viewings"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_viewings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "property_management"."property_viewings" TO "monpiole_runtime";
