ALTER TABLE "property_management"."properties" ADD COLUMN "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "published_by_actor_id" text;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "publication_correlation_id" uuid;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" DROP CONSTRAINT "properties_status_check";
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_status_check"
CHECK ("status" IN ('DRAFT', 'PUBLISHED'));
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_publication_state_check" CHECK (
  ("status" = 'DRAFT' AND "published_at" IS NULL AND "published_by_actor_id" IS NULL AND "publication_correlation_id" IS NULL)
  OR
  ("status" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "published_by_actor_id" IS NOT NULL
    AND "publication_correlation_id" IS NOT NULL AND "commercial_kind" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "properties_tenant_status_created_property_idx"
ON "property_management"."properties" USING btree ("tenant_id", "status", "created_at" DESC NULLS LAST, "property_id" DESC NULLS LAST);
