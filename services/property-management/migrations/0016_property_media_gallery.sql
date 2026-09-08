ALTER TABLE "property_management"."property_photos" ADD COLUMN "media_kind" text DEFAULT 'IMAGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD COLUMN "gallery_position" integer;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_media_kind_check" CHECK ("property_management"."property_photos"."media_kind" = 'IMAGE');--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_gallery_position_check" CHECK (
    ("property_management"."property_photos"."content_base64" IS NULL AND "property_management"."property_photos"."gallery_position" IS NULL)
    OR ("property_management"."property_photos"."content_base64" IS NOT NULL
      AND "property_management"."property_photos"."gallery_position" IS NOT NULL
      AND "property_management"."property_photos"."gallery_position" >= 0)
  ) NOT VALID;--> statement-breakpoint
CREATE UNIQUE INDEX "property_photos_gallery_position_unique_idx" ON "property_management"."property_photos" USING btree ("tenant_id","property_id","gallery_position") WHERE "property_management"."property_photos"."gallery_position" IS NOT NULL;--> statement-breakpoint
WITH "ordered_gallery" AS (
  SELECT "photo_id", row_number() OVER (
    PARTITION BY "tenant_id", "property_id"
    ORDER BY "registered_at", "photo_id"
  ) - 1 AS "position"
  FROM "property_management"."property_photos"
  WHERE "status" = 'AVAILABLE' AND "content_base64" IS NOT NULL
)
UPDATE "property_management"."property_photos" AS "photo"
SET "gallery_position" = "ordered_gallery"."position"
FROM "ordered_gallery"
WHERE "photo"."photo_id" = "ordered_gallery"."photo_id";--> statement-breakpoint
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" VALIDATE CONSTRAINT "property_photos_gallery_position_check";--> statement-breakpoint
DROP POLICY "property_photos_public_catalog_primary_select" ON "property_management"."property_photos";--> statement-breakpoint
CREATE POLICY "property_photos_public_catalog_media_select"
ON "property_management"."property_photos"
AS RESTRICTIVE FOR SELECT TO "monpiole_public_catalog_reader"
USING (
  "status" = 'AVAILABLE'
  AND "content_base64" IS NOT NULL
  AND "content_type" IS NOT NULL
  AND "content_byte_size" IS NOT NULL
  AND "content_sha256" IS NOT NULL
  AND "media_kind" = 'IMAGE'
  AND "gallery_position" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "property_management"."properties" AS "public_catalog_property"
    WHERE "public_catalog_property"."tenant_id" = "property_management"."property_photos"."tenant_id"
      AND "public_catalog_property"."property_id" = "property_management"."property_photos"."property_id"
      AND "public_catalog_property"."status" = 'PUBLISHED'
  )
);--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ("photo_id", "category", "media_kind", "gallery_position")
ON TABLE "property_management"."property_photos" TO "monpiole_public_catalog_reader";
