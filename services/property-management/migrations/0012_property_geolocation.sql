CREATE TABLE "property_management"."property_geolocations" (
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"latitude" numeric(8, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"public_visibility" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_geolocations_pkey" PRIMARY KEY("tenant_id","property_id"),
	CONSTRAINT "property_geolocations_latitude_check" CHECK ("property_management"."property_geolocations"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "property_geolocations_longitude_check" CHECK ("property_management"."property_geolocations"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "property_geolocations_public_visibility_check" CHECK ("property_management"."property_geolocations"."public_visibility" IN ('EXACT', 'APPROXIMATE', 'HIDDEN'))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_geolocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_geolocations" ADD CONSTRAINT "property_geolocations_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "property_geolocations_tenant_isolation" ON "property_management"."property_geolocations" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_geolocations"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_geolocations"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_geolocations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "property_management"."property_geolocations" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "property_management"."property_geolocations" FROM "monpiole_public_catalog_reader";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "property_management"."property_geolocations" TO "monpiole_runtime";
