ALTER TABLE "property_management"."properties" ADD COLUMN "availability_status" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "occupancy_status" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "availability_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "availability_updated_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "availability_correlation_id" uuid;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_availability_occupancy_check" CHECK (
    ("property_management"."properties"."availability_status" IS NULL AND "property_management"."properties"."occupancy_status" IS NULL
      AND "property_management"."properties"."availability_updated_at" IS NULL AND "property_management"."properties"."availability_updated_by_actor_id" IS NULL
      AND "property_management"."properties"."availability_correlation_id" IS NULL)
    OR
    ("property_management"."properties"."structural_role" IN ('STANDALONE', 'UNIT')
      AND "property_management"."properties"."availability_status" IN ('AVAILABLE', 'UNAVAILABLE')
      AND "property_management"."properties"."occupancy_status" IN ('VACANT', 'OCCUPIED')
      AND "property_management"."properties"."availability_updated_at" IS NOT NULL AND "property_management"."properties"."availability_updated_by_actor_id" IS NOT NULL
      AND "property_management"."properties"."availability_correlation_id" IS NOT NULL)
  );