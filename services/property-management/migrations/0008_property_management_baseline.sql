CREATE TABLE "property_management"."property_photos" (
	"photo_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	CONSTRAINT "property_photos_category_check" CHECK ("property_management"."property_photos"."category" IN ('EXTERIOR', 'INTERIOR', 'LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'OTHER')),
	CONSTRAINT "property_photos_status_check" CHECK ("property_management"."property_photos"."status" = 'AVAILABLE'),
	CONSTRAINT "property_photos_url_check" CHECK (char_length("property_management"."property_photos"."url") BETWEEN 1 AND 2048 AND "property_management"."property_photos"."url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_management"."property_primary_photo_audits" (
	"audit_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"previous_photo_id" uuid,
	"selected_photo_id" uuid NOT NULL,
	"property_status" text NOT NULL,
	"selected_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_primary_photo_audits_status_check" CHECK ("property_management"."property_primary_photo_audits"."property_status" IN ('DRAFT', 'PUBLISHED')),
	CONSTRAINT "property_primary_photo_audits_replacement_check" CHECK ("property_management"."property_primary_photo_audits"."previous_photo_id" IS NULL OR "property_management"."property_primary_photo_audits"."previous_photo_id" <> "property_management"."property_primary_photo_audits"."selected_photo_id")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" ADD CONSTRAINT "property_photos_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" ADD CONSTRAINT "property_primary_photo_audits_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_photos_tenant_property_photo_unique" ON "property_management"."property_photos" USING btree ("tenant_id","property_id","photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_photos_one_primary_per_property_idx" ON "property_management"."property_photos" USING btree ("tenant_id","property_id") WHERE "property_management"."property_photos"."is_primary";--> statement-breakpoint
CREATE INDEX "property_photos_tenant_property_registered_idx" ON "property_management"."property_photos" USING btree ("tenant_id","property_id","registered_at","photo_id");--> statement-breakpoint
CREATE INDEX "property_primary_photo_audits_tenant_property_selected_idx" ON "property_management"."property_primary_photo_audits" USING btree ("tenant_id","property_id","selected_at","audit_id");--> statement-breakpoint
CREATE POLICY "property_photos_tenant_isolation" ON "property_management"."property_photos" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_photos"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_photos"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "property_primary_photo_audits_tenant_isolation" ON "property_management"."property_primary_photo_audits" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_primary_photo_audits"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_primary_photo_audits"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE FUNCTION "property_management"."protect_primary_property_photo"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_primary THEN
    RAISE EXCEPTION 'Select a replacement before deleting the primary Property photo'
      USING ERRCODE = '23514', CONSTRAINT = 'property_photos_primary_delete_guard';
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "property_photos_primary_delete_guard"
BEFORE DELETE ON "property_management"."property_photos"
FOR EACH ROW EXECUTE FUNCTION "property_management"."protect_primary_property_photo"();
--> statement-breakpoint
CREATE FUNCTION "property_management"."protect_primary_photo_audit"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Primary Property photo audit records are append-only'
    USING ERRCODE = '23514', CONSTRAINT = 'property_primary_photo_audits_append_only_guard';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "property_primary_photo_audits_append_only_guard"
BEFORE UPDATE OR DELETE ON "property_management"."property_primary_photo_audits"
FOR EACH ROW EXECUTE FUNCTION "property_management"."protect_primary_photo_audit"();
--> statement-breakpoint
CREATE FUNCTION "property_management"."assert_published_property_primary_photo"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_tenant_id uuid;
  target_property_id uuid;
  target_status text;
  primary_count integer;
BEGIN
  target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  target_property_id := COALESCE(NEW.property_id, OLD.property_id);
  SELECT status INTO target_status
  FROM "property_management"."properties"
  WHERE tenant_id = target_tenant_id AND property_id = target_property_id;
  IF target_status = 'PUBLISHED' THEN
    SELECT count(*) INTO primary_count
    FROM "property_management"."property_photos"
    WHERE tenant_id = target_tenant_id AND property_id = target_property_id
      AND status = 'AVAILABLE' AND is_primary;
    IF primary_count <> 1 THEN
      RAISE EXCEPTION 'A published Property requires exactly one available primary photo'
        USING ERRCODE = '23514', CONSTRAINT = 'properties_published_primary_photo_guard';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "property_photos_published_primary_guard"
AFTER INSERT OR UPDATE OR DELETE ON "property_management"."property_photos"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "property_management"."assert_published_property_primary_photo"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "properties_published_primary_photo_guard"
AFTER INSERT OR UPDATE ON "property_management"."properties"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "property_management"."assert_published_property_primary_photo"();
