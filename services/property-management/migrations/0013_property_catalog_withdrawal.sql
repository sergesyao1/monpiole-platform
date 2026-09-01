ALTER TABLE "property_management"."properties" DROP CONSTRAINT "properties_status_check";--> statement-breakpoint
ALTER TABLE "property_management"."properties" DROP CONSTRAINT "properties_publication_state_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" DROP CONSTRAINT "property_primary_photo_audits_status_check";--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "withdrawn_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "withdrawal_correlation_id" uuid;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_status_check" CHECK ("property_management"."properties"."status" IN ('DRAFT', 'PUBLISHED', 'WITHDRAWN'));--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_publication_state_check" CHECK (
    ("property_management"."properties"."status" = 'DRAFT' AND "property_management"."properties"."published_at" IS NULL AND "property_management"."properties"."published_by_actor_id" IS NULL
      AND "property_management"."properties"."publication_correlation_id" IS NULL AND "property_management"."properties"."withdrawn_at" IS NULL
      AND "property_management"."properties"."withdrawn_by_actor_id" IS NULL AND "property_management"."properties"."withdrawal_correlation_id" IS NULL)
    OR
    ("property_management"."properties"."status" = 'PUBLISHED' AND "property_management"."properties"."published_at" IS NOT NULL AND "property_management"."properties"."published_by_actor_id" IS NOT NULL
      AND "property_management"."properties"."publication_correlation_id" IS NOT NULL AND "property_management"."properties"."withdrawn_at" IS NULL
      AND "property_management"."properties"."withdrawn_by_actor_id" IS NULL AND "property_management"."properties"."withdrawal_correlation_id" IS NULL
      AND "property_management"."properties"."commercial_kind" IS NOT NULL)
    OR
    ("property_management"."properties"."status" = 'WITHDRAWN' AND "property_management"."properties"."published_at" IS NOT NULL AND "property_management"."properties"."published_by_actor_id" IS NOT NULL
      AND "property_management"."properties"."publication_correlation_id" IS NOT NULL AND "property_management"."properties"."withdrawn_at" IS NOT NULL
      AND "property_management"."properties"."withdrawn_by_actor_id" IS NOT NULL AND "property_management"."properties"."withdrawal_correlation_id" IS NOT NULL
      AND "property_management"."properties"."withdrawn_at" >= "property_management"."properties"."published_at" AND "property_management"."properties"."commercial_kind" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" ADD CONSTRAINT "property_primary_photo_audits_status_check" CHECK ("property_management"."property_primary_photo_audits"."property_status" IN ('DRAFT', 'PUBLISHED', 'WITHDRAWN'));