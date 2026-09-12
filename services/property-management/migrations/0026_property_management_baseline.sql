CREATE TABLE "property_management"."property_complex_children" (
	"tenant_id" uuid NOT NULL,
	"complex_property_id" uuid NOT NULL,
	"child_property_id" uuid NOT NULL,
	"child_code" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_complex_children_pkey" PRIMARY KEY("tenant_id","child_property_id"),
	CONSTRAINT "property_complex_children_distinct_check" CHECK ("property_management"."property_complex_children"."complex_property_id" <> "property_management"."property_complex_children"."child_property_id"),
	CONSTRAINT "property_complex_children_code_check" CHECK ("property_management"."property_complex_children"."child_code" ~ '^[A-Z0-9][A-Z0-9._/ -]{0,49}$')
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_complex_children" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."properties" DROP CONSTRAINT "properties_availability_occupancy_check";--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "commercialization_mode" text;--> statement-breakpoint
ALTER TABLE "property_management"."property_complex_children" ADD CONSTRAINT "property_complex_children_complex_tenant_fk" FOREIGN KEY ("tenant_id","complex_property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_complex_children" ADD CONSTRAINT "property_complex_children_child_tenant_fk" FOREIGN KEY ("tenant_id","child_property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_complex_children_tenant_complex_code_unique" ON "property_management"."property_complex_children" USING btree ("tenant_id","complex_property_id","child_code");--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_commercialization_mode_check" CHECK (("property_management"."properties"."property_type" = 'BUILDING' AND "property_management"."properties"."commercialization_mode" IS NOT NULL AND "property_management"."properties"."commercialization_mode" IN ('WHOLE_BUILDING', 'INDIVIDUAL_UNITS')) OR ("property_management"."properties"."property_type" <> 'BUILDING' AND "property_management"."properties"."commercialization_mode" IS NULL));--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_commercial_target_check" CHECK ("property_management"."properties"."status" <> 'PUBLISHED' OR ("property_management"."properties"."property_type" <> 'COMPLEX' AND ("property_management"."properties"."property_type" <> 'BUILDING' OR "property_management"."properties"."commercialization_mode" = 'WHOLE_BUILDING')));--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_availability_occupancy_check" CHECK (
    ("property_management"."properties"."availability_status" IS NULL AND "property_management"."properties"."occupancy_status" IS NULL
      AND "property_management"."properties"."availability_updated_at" IS NULL AND "property_management"."properties"."availability_updated_by_actor_id" IS NULL
      AND "property_management"."properties"."availability_correlation_id" IS NULL)
    OR
    (("property_management"."properties"."structural_role" IN ('STANDALONE', 'UNIT') OR ("property_management"."properties"."property_type" = 'BUILDING' AND "property_management"."properties"."commercialization_mode" = 'WHOLE_BUILDING'))
      AND "property_management"."properties"."availability_status" IN ('AVAILABLE', 'UNAVAILABLE')
      AND "property_management"."properties"."occupancy_status" IN ('VACANT', 'OCCUPIED')
      AND "property_management"."properties"."availability_updated_at" IS NOT NULL AND "property_management"."properties"."availability_updated_by_actor_id" IS NOT NULL
      AND "property_management"."properties"."availability_correlation_id" IS NOT NULL)
  );--> statement-breakpoint
CREATE POLICY "property_complex_children_tenant_isolation" ON "property_management"."property_complex_children" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_complex_children"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_complex_children"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_complex_children" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "property_management"."property_complex_children" TO "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT ("commercialization_mode"), INSERT ("commercialization_mode") ON TABLE "property_management"."properties" TO "monpiole_runtime";
