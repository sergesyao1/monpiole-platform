CREATE TABLE "property_management"."property_effective_geographies" (
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"country_code" text,
	"city" text,
	"commune" text,
	"quartier" text,
	"inherit_missing" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_effective_geographies_pkey" PRIMARY KEY("tenant_id","property_id"),
	CONSTRAINT "property_effective_geographies_country_check" CHECK ("property_management"."property_effective_geographies"."country_code" IS NULL OR "property_management"."property_effective_geographies"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "property_effective_geographies_text_check" CHECK (
    ("property_management"."property_effective_geographies"."city" IS NULL OR char_length(btrim("property_management"."property_effective_geographies"."city")) BETWEEN 1 AND 200)
    AND ("property_management"."property_effective_geographies"."commune" IS NULL OR char_length(btrim("property_management"."property_effective_geographies"."commune")) BETWEEN 1 AND 200)
    AND ("property_management"."property_effective_geographies"."quartier" IS NULL OR char_length(btrim("property_management"."property_effective_geographies"."quartier")) BETWEEN 1 AND 200)
  ),
	CONSTRAINT "property_effective_geographies_inheritance_check" CHECK ("property_management"."property_effective_geographies"."inherit_missing" OR ("property_management"."property_effective_geographies"."country_code" IS NOT NULL AND "property_management"."property_effective_geographies"."city" IS NOT NULL AND ("property_management"."property_effective_geographies"."commune" IS NOT NULL OR "property_management"."property_effective_geographies"."quartier" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_effective_geographies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_effective_geographies" ADD CONSTRAINT "property_effective_geographies_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_effective_geographies_tenant_search_idx" ON "property_management"."property_effective_geographies" USING btree ("tenant_id","country_code","city","commune","quartier");--> statement-breakpoint
CREATE POLICY "property_effective_geographies_tenant_isolation" ON "property_management"."property_effective_geographies" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_effective_geographies"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_effective_geographies"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_effective_geographies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "property_management"."property_effective_geographies" TO "monpiole_runtime";
--> statement-breakpoint
CREATE VIEW "property_management"."property_geography_sources" WITH (security_barrier = true) AS
SELECT p.tenant_id, p.property_id,
  CASE WHEN g.property_id IS NULL THEN p.country ELSE g.country_code END AS country_code,
  CASE WHEN g.property_id IS NULL THEN p.city ELSE g.city END AS city,
  CASE WHEN g.property_id IS NULL THEN p.district ELSE g.commune END AS commune,
  CASE WHEN g.property_id IS NULL THEN NULL::text ELSE g.quartier END AS quartier,
  COALESCE(g.inherit_missing, false) AS inherit_missing
FROM property_management.properties p
LEFT JOIN property_management.property_effective_geographies g
  ON g.tenant_id=p.tenant_id AND g.property_id=p.property_id
WHERE p.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid;
--> statement-breakpoint
REVOKE ALL ON TABLE "property_management"."property_geography_sources" FROM PUBLIC;
GRANT SELECT ON TABLE "property_management"."property_geography_sources" TO "monpiole_public_catalog_reader";
GRANT SELECT ("tenant_id", "building_id", "unit_property_id") ON TABLE "property_management"."property_building_units" TO "monpiole_public_catalog_reader";
GRANT SELECT ("tenant_id", "building_id", "property_id", "building_property_id") ON TABLE "property_management"."property_buildings" TO "monpiole_public_catalog_reader";
GRANT SELECT ("tenant_id", "complex_property_id", "child_property_id") ON TABLE "property_management"."property_complex_children" TO "monpiole_public_catalog_reader";
