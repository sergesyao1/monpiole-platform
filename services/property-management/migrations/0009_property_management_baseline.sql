CREATE TABLE "property_management"."property_photo_standards" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"minimum_photo_count" integer DEFAULT 1 NOT NULL,
	"additional_required_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_photo_standards_minimum_check" CHECK ("property_management"."property_photo_standards"."minimum_photo_count" >= 1),
	CONSTRAINT "property_photo_standards_categories_check" CHECK ("property_management"."property_photo_standards"."additional_required_categories" <@ ARRAY[
    'BUILDING_EXTERIOR_OR_ENTRANCE', 'MAIN_LIVING_SLEEPING_AREA', 'LIVING_ROOM_OR_MAIN_ROOM',
    'KITCHEN_OR_KITCHENETTE', 'BEDROOM_OR_SLEEPING_AREA', 'BATHROOM_OR_SHOWER_ROOM', 'OTHER'
  ]::text[])
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_photo_standards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" DROP CONSTRAINT "property_photos_category_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" DROP CONSTRAINT "property_photos_status_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" DROP CONSTRAINT "property_photos_url_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ALTER COLUMN "available_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "apartment_subtype" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "photo_standard_version" integer;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD COLUMN "content_base64" text;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD COLUMN "content_byte_size" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD COLUMN "content_sha256" text;--> statement-breakpoint
DROP TRIGGER IF EXISTS "property_photos_published_primary_guard" ON "property_management"."property_photos";--> statement-breakpoint
DROP TRIGGER IF EXISTS "properties_published_primary_photo_guard" ON "property_management"."properties";--> statement-breakpoint
DROP FUNCTION IF EXISTS "property_management"."assert_published_property_primary_photo"();--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_apartment_subtype_check" CHECK (
    "property_management"."properties"."apartment_subtype" IS NULL
    OR ("property_management"."properties"."property_type" = 'APARTMENT' AND "property_management"."properties"."transaction_type" = 'LONG_TERM_RENTAL'
      AND "property_management"."properties"."apartment_subtype" IN ('STUDIO', 'MULTI_ROOM'))
  );--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_photo_standard_version_check"
CHECK ("photo_standard_version" IS NULL OR "photo_standard_version" = 1);--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_content_check" CHECK (
    ("property_management"."property_photos"."content_base64" IS NULL AND "property_management"."property_photos"."content_type" IS NULL
      AND "property_management"."property_photos"."content_byte_size" IS NULL AND "property_management"."property_photos"."content_sha256" IS NULL
      AND "property_management"."property_photos"."url" IS NOT NULL)
    OR
    ("property_management"."property_photos"."status" = 'AVAILABLE' AND "property_management"."property_photos"."content_base64" IS NOT NULL AND char_length("property_management"."property_photos"."content_base64") > 0
      AND "property_management"."property_photos"."content_type" IN ('image/jpeg', 'image/png', 'image/webp')
      AND octet_length(decode("property_management"."property_photos"."content_base64", 'base64')) = "property_management"."property_photos"."content_byte_size"
      AND "property_management"."property_photos"."content_byte_size" > 0 AND "property_management"."property_photos"."content_sha256" ~ '^[0-9a-f]{64}$' AND "property_management"."property_photos"."available_at" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_category_check" CHECK ("property_management"."property_photos"."category" IN (
    'BUILDING_EXTERIOR_OR_ENTRANCE', 'MAIN_LIVING_SLEEPING_AREA', 'LIVING_ROOM_OR_MAIN_ROOM',
    'KITCHEN_OR_KITCHENETTE', 'BEDROOM_OR_SLEEPING_AREA', 'BATHROOM_OR_SHOWER_ROOM',
    'EXTERIOR', 'INTERIOR', 'LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'OTHER'
  ));--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_status_check" CHECK ("property_management"."property_photos"."status" IN ('PENDING', 'AVAILABLE'));--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_url_check" CHECK ("property_management"."property_photos"."url" IS NULL OR (char_length("property_management"."property_photos"."url") BETWEEN 1 AND 2048 AND "property_management"."property_photos"."url" ~ '^https://'));--> statement-breakpoint
CREATE POLICY "property_photo_standards_tenant_isolation" ON "property_management"."property_photo_standards" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_photo_standards"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_photo_standards"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_photo_standards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE FUNCTION "property_management"."assert_published_property_photo_standard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_tenant_id uuid;
  target_property_id uuid;
  target_status text;
  target_property_type text;
  target_transaction_type text;
  target_apartment_subtype text;
  target_photo_standard_version integer;
  monpiole_minimum integer := 1;
  organization_minimum integer := 1;
  available_count integer;
  primary_count integer;
  required_categories text[] := ARRAY[]::text[];
  organization_categories text[] := ARRAY[]::text[];
  missing_category text;
BEGIN
  target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  target_property_id := COALESCE(NEW.property_id, OLD.property_id);
  SELECT status, property_type, transaction_type, apartment_subtype, photo_standard_version
  INTO target_status, target_property_type, target_transaction_type, target_apartment_subtype, target_photo_standard_version
  FROM "property_management"."properties"
  WHERE tenant_id = target_tenant_id AND property_id = target_property_id;

  IF target_status = 'PUBLISHED' AND target_photo_standard_version = 1 THEN
    IF target_property_type = 'APARTMENT' AND target_transaction_type = 'LONG_TERM_RENTAL' THEN
      IF target_apartment_subtype IS NULL THEN
        RAISE EXCEPTION 'A published long-term rental Apartment requires an explicit subtype'
          USING ERRCODE = '23514', CONSTRAINT = 'properties_published_photo_standard_guard';
      END IF;
      monpiole_minimum := 6;
      IF target_apartment_subtype = 'STUDIO' THEN
        required_categories := ARRAY[
          'BUILDING_EXTERIOR_OR_ENTRANCE', 'MAIN_LIVING_SLEEPING_AREA',
          'KITCHEN_OR_KITCHENETTE', 'BATHROOM_OR_SHOWER_ROOM'
        ];
      ELSE
        required_categories := ARRAY[
          'BUILDING_EXTERIOR_OR_ENTRANCE', 'LIVING_ROOM_OR_MAIN_ROOM',
          'KITCHEN_OR_KITCHENETTE', 'BEDROOM_OR_SLEEPING_AREA', 'BATHROOM_OR_SHOWER_ROOM'
        ];
      END IF;
    END IF;

    SELECT minimum_photo_count, additional_required_categories
    INTO organization_minimum, organization_categories
    FROM "property_management"."property_photo_standards"
    WHERE tenant_id = target_tenant_id;
    organization_minimum := COALESCE(organization_minimum, 1);
    organization_categories := COALESCE(organization_categories, ARRAY[]::text[]);
    required_categories := ARRAY(SELECT DISTINCT unnest(required_categories || organization_categories));

    SELECT count(*), count(*) FILTER (WHERE is_primary)
    INTO available_count, primary_count
    FROM "property_management"."property_photos"
    WHERE tenant_id = target_tenant_id AND property_id = target_property_id
      AND status = 'AVAILABLE' AND content_base64 IS NOT NULL;
    IF available_count < GREATEST(monpiole_minimum, organization_minimum) OR primary_count <> 1 THEN
      RAISE EXCEPTION 'A published Property does not satisfy its available photo minimum or primary-photo rule'
        USING ERRCODE = '23514', CONSTRAINT = 'properties_published_photo_standard_guard';
    END IF;

    SELECT category INTO missing_category
    FROM unnest(required_categories) AS category
    WHERE NOT EXISTS (
      SELECT 1 FROM "property_management"."property_photos" photo
      WHERE photo.tenant_id = target_tenant_id AND photo.property_id = target_property_id
        AND photo.status = 'AVAILABLE' AND photo.content_base64 IS NOT NULL AND photo.category = category
    ) LIMIT 1;
    IF missing_category IS NOT NULL THEN
      RAISE EXCEPTION 'A published Property is missing a mandatory photo view'
        USING ERRCODE = '23514', CONSTRAINT = 'properties_published_photo_standard_guard';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION "property_management"."mark_property_photo_standard_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'PUBLISHED' THEN
    NEW.photo_standard_version := 1;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'DRAFT' AND NEW.status = 'PUBLISHED' THEN
    NEW.photo_standard_version := 1;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "properties_photo_standard_version_marker"
BEFORE INSERT OR UPDATE ON "property_management"."properties"
FOR EACH ROW EXECUTE FUNCTION "property_management"."mark_property_photo_standard_version"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "property_photos_published_standard_guard"
AFTER INSERT OR UPDATE OR DELETE ON "property_management"."property_photos"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "property_management"."assert_published_property_photo_standard"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "properties_published_photo_standard_guard"
AFTER INSERT OR UPDATE ON "property_management"."properties"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "property_management"."assert_published_property_photo_standard"();
