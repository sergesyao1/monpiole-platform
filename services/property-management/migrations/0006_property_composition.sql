ALTER TABLE "property_management"."properties" ADD COLUMN "structural_role" text DEFAULT 'STANDALONE' NOT NULL;
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_structural_role_check" CHECK ("structural_role" IN ('STANDALONE', 'COMPOSITE', 'UNIT'));

CREATE TABLE "property_management"."property_buildings" (
  "building_id" uuid PRIMARY KEY NOT NULL, "tenant_id" uuid NOT NULL, "property_id" uuid NOT NULL,
  "building_code" text NOT NULL, "name" text NOT NULL, "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL, "correlation_id" uuid NOT NULL, "actor_id" text NOT NULL,
  CONSTRAINT "property_buildings_code_check" CHECK ("building_code" ~ '^[A-Z0-9][A-Z0-9._/ -]{0,49}$'),
  CONSTRAINT "property_buildings_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "property_buildings_tenant_building_unique" UNIQUE("tenant_id", "building_id"),
  CONSTRAINT "property_buildings_tenant_property_code_unique" UNIQUE("tenant_id", "property_id", "building_code"),
  CONSTRAINT "property_buildings_property_tenant_fk" FOREIGN KEY ("tenant_id", "property_id") REFERENCES "property_management"."properties"("tenant_id", "property_id") ON DELETE NO ACTION
);
CREATE INDEX "property_buildings_tenant_property_code_idx" ON "property_management"."property_buildings" ("tenant_id", "property_id", "building_code", "building_id");

CREATE TABLE "property_management"."property_building_units" (
  "tenant_id" uuid NOT NULL, "building_id" uuid NOT NULL, "unit_property_id" uuid NOT NULL,
  "unit_code" text NOT NULL, "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
  "correlation_id" uuid NOT NULL, "actor_id" text NOT NULL,
  CONSTRAINT "property_building_units_pkey" PRIMARY KEY("tenant_id", "building_id", "unit_property_id"),
  CONSTRAINT "property_building_units_code_check" CHECK ("unit_code" ~ '^[A-Z0-9][A-Z0-9._/ -]{0,49}$'),
  CONSTRAINT "property_building_units_tenant_unit_unique" UNIQUE("tenant_id", "unit_property_id"),
  CONSTRAINT "property_building_units_tenant_building_code_unique" UNIQUE("tenant_id", "building_id", "unit_code"),
  CONSTRAINT "property_building_units_building_tenant_fk" FOREIGN KEY ("tenant_id", "building_id") REFERENCES "property_management"."property_buildings"("tenant_id", "building_id") ON DELETE NO ACTION,
  CONSTRAINT "property_building_units_property_tenant_fk" FOREIGN KEY ("tenant_id", "unit_property_id") REFERENCES "property_management"."properties"("tenant_id", "property_id") ON DELETE NO ACTION
);
CREATE INDEX "property_building_units_tenant_building_code_idx" ON "property_management"."property_building_units" ("tenant_id", "building_id", "unit_code", "unit_property_id");

ALTER TABLE "property_management"."property_buildings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_management"."property_buildings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "property_buildings_tenant_isolation" ON "property_management"."property_buildings" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "property_management"."property_building_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_management"."property_building_units" FORCE ROW LEVEL SECURITY;
CREATE POLICY "property_building_units_tenant_isolation" ON "property_management"."property_building_units" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
