CREATE INDEX "properties_public_catalog_idx" ON "property_management"."properties" USING btree ("tenant_id","published_at" DESC NULLS LAST,"property_id" DESC NULLS LAST) WHERE "property_management"."properties"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE POLICY "properties_public_catalog_published_select" ON "property_management"."properties" AS RESTRICTIVE FOR SELECT TO "monpiole_public_catalog_reader" USING ("property_management"."properties"."status" = 'PUBLISHED');--> statement-breakpoint
CREATE POLICY "property_photos_public_catalog_primary_select" ON "property_management"."property_photos" AS RESTRICTIVE FOR SELECT TO "monpiole_public_catalog_reader" USING (
      "property_management"."property_photos"."status" = 'AVAILABLE'
      AND "property_management"."property_photos"."is_primary" = TRUE
      AND "property_management"."property_photos"."content_base64" IS NOT NULL
      AND "property_management"."property_photos"."content_type" IS NOT NULL
      AND "property_management"."property_photos"."content_byte_size" IS NOT NULL
      AND "property_management"."property_photos"."content_sha256" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "property_management"."properties" AS "public_catalog_property"
        WHERE "public_catalog_property"."tenant_id" = "property_management"."property_photos"."tenant_id"
          AND "public_catalog_property"."property_id" = "property_management"."property_photos"."property_id"
          AND "public_catalog_property"."status" = 'PUBLISHED'
      )
    );
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SCHEMA "property_management" FROM "monpiole_public_catalog_reader";
--> statement-breakpoint
GRANT USAGE ON SCHEMA "property_management" TO "monpiole_public_catalog_reader";
--> statement-breakpoint
REVOKE CREATE ON SCHEMA "property_management" FROM "monpiole_public_catalog_reader";
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "property_management" FROM "monpiole_public_catalog_reader";
--> statement-breakpoint
GRANT SELECT (
  "property_id", "tenant_id", "title", "description", "property_type", "transaction_type",
  "apartment_subtype", "status", "structural_role", "country", "city", "district",
  "published_at", "usable_surface_square_meters", "rooms", "bedrooms", "bathrooms", "furnished",
  "commercial_kind", "currency", "rent_amount_minor", "rent_period",
  "security_deposit_amount_minor", "charges_amount_minor", "rate_amount_minor", "pricing_unit",
  "sale_price_amount_minor"
) ON TABLE "property_management"."properties" TO "monpiole_public_catalog_reader";
--> statement-breakpoint
GRANT SELECT (
  "tenant_id", "property_id", "status", "is_primary", "content_base64", "content_type",
  "content_byte_size", "content_sha256"
) ON TABLE "property_management"."property_photos" TO "monpiole_public_catalog_reader";
