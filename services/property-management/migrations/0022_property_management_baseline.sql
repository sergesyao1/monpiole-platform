CREATE TABLE "property_management"."property_applications" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"viewing_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_applications_note_check" CHECK ("property_management"."property_applications"."note" IS NULL OR char_length(btrim("property_management"."property_applications"."note")) BETWEEN 1 AND 2000),
	CONSTRAINT "property_applications_lifecycle_check" CHECK (("property_management"."property_applications"."status"='SUBMITTED' AND "property_management"."property_applications"."decided_at" IS NULL) OR ("property_management"."property_applications"."status" IN ('APPROVED','REJECTED','WITHDRAWN') AND "property_management"."property_applications"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" ADD CONSTRAINT "property_applications_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" ADD CONSTRAINT "property_applications_viewing_tenant_fk" FOREIGN KEY ("tenant_id","property_id","viewing_id") REFERENCES "property_management"."property_viewings"("tenant_id","property_id","viewing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" ADD CONSTRAINT "property_applications_outcome_tenant_fk" FOREIGN KEY ("tenant_id","outcome_id") REFERENCES "property_management"."property_viewing_outcomes"("tenant_id","outcome_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_applications" ADD CONSTRAINT "property_applications_inquiry_tenant_fk" FOREIGN KEY ("tenant_id","inquiry_id") REFERENCES "property_management"."property_inquiries"("tenant_id","inquiry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_applications_tenant_application_unique" ON "property_management"."property_applications" USING btree ("tenant_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_applications_tenant_viewing_unique" ON "property_management"."property_applications" USING btree ("tenant_id","viewing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_applications_tenant_outcome_unique" ON "property_management"."property_applications" USING btree ("tenant_id","outcome_id");--> statement-breakpoint
CREATE INDEX "property_applications_tenant_property_created_idx" ON "property_management"."property_applications" USING btree ("tenant_id","property_id","created_at" DESC NULLS LAST,"application_id" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "property_applications_tenant_isolation" ON "property_management"."property_applications" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_applications"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("property_management"."property_applications"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "property_management"."property_applications" TO "monpiole_runtime";
