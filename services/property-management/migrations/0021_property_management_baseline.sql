CREATE TABLE "property_management"."property_viewing_outcomes" (
	"outcome_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"viewing_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_viewing_outcomes_note_check" CHECK ("property_management"."property_viewing_outcomes"."note" IS NULL OR char_length(btrim("property_management"."property_viewing_outcomes"."note")) BETWEEN 1 AND 2000),
	CONSTRAINT "property_viewing_outcomes_lifecycle_check" CHECK (("property_management"."property_viewing_outcomes"."status"='FOLLOW_UP_REQUIRED' AND "property_management"."property_viewing_outcomes"."decided_at" IS NULL) OR ("property_management"."property_viewing_outcomes"."status" IN ('PROCEED','DECLINED') AND "property_management"."property_viewing_outcomes"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_viewing_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "property_viewings_tenant_property_viewing_unique" ON "property_management"."property_viewings" USING btree ("tenant_id","property_id","viewing_id");--> statement-breakpoint
ALTER TABLE "property_management"."property_viewing_outcomes" ADD CONSTRAINT "property_viewing_outcomes_viewing_tenant_fk" FOREIGN KEY ("tenant_id","property_id","viewing_id") REFERENCES "property_management"."property_viewings"("tenant_id","property_id","viewing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_viewing_outcomes_tenant_outcome_unique" ON "property_management"."property_viewing_outcomes" USING btree ("tenant_id","outcome_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_viewing_outcomes_tenant_viewing_unique" ON "property_management"."property_viewing_outcomes" USING btree ("tenant_id","viewing_id");--> statement-breakpoint
CREATE POLICY "property_viewing_outcomes_tenant_isolation" ON "property_management"."property_viewing_outcomes" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_viewing_outcomes"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("property_management"."property_viewing_outcomes"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_viewing_outcomes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "property_management"."property_viewing_outcomes" TO "monpiole_runtime";
