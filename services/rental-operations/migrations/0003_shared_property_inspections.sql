ALTER TABLE "rental_operations"."property_inspections" ALTER COLUMN "occupancy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "rentable_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "source_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "source_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "lifecycle_status" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "responsible_actor_id" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "condition_records" jsonb;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "evidence_references" jsonb;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "rental_operations"."property_inspections" i SET
  "rentable_asset_id"=o."rentable_asset_id",
  "source_lease_id"=CASE WHEN i."inspection_type"='ENTRY' THEN o."source_lease_id" ELSE NULL END,
  "source_booking_id"=CASE WHEN i."inspection_type"='ENTRY' THEN s."booking_id" ELSE NULL END,
  "occupancy_id"=CASE WHEN i."inspection_type"='EXIT' THEN i."occupancy_id" ELSE NULL END,
  "lifecycle_status"='COMPLETED', "responsible_actor_id"='legacy-migration',
  "idempotency_key"=i."inspection_id", "condition_records"='[]'::jsonb,
  "evidence_references"='[]'::jsonb, "updated_at"=i."created_at"
FROM "rental_operations"."occupancies" o
LEFT JOIN "rental_operations"."stays" s ON s."tenant_id"=o."tenant_id" AND s."stay_id"=o."source_stay_id"
WHERE i."tenant_id"=o."tenant_id" AND i."occupancy_id"=o."occupancy_id";--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections"
  ALTER COLUMN "rentable_asset_id" SET NOT NULL,
  ALTER COLUMN "lifecycle_status" SET NOT NULL,
  ALTER COLUMN "responsible_actor_id" SET NOT NULL,
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "condition_records" SET NOT NULL,
  ALTER COLUMN "evidence_references" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD CONSTRAINT "property_inspections_lease_tenant_fk" FOREIGN KEY ("tenant_id","source_lease_id","rentable_asset_id") REFERENCES "rental_operations"."leases"("tenant_id","lease_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD CONSTRAINT "property_inspections_booking_tenant_fk" FOREIGN KEY ("tenant_id","source_booking_id","rentable_asset_id") REFERENCES "rental_operations"."bookings"("tenant_id","booking_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_inspections_tenant_idempotency_unique" ON "rental_operations"."property_inspections" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "property_inspections_tenant_lease_type_unique" ON "rental_operations"."property_inspections" USING btree ("tenant_id","source_lease_id","inspection_type") WHERE "rental_operations"."property_inspections"."source_lease_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "property_inspections_tenant_booking_type_unique" ON "rental_operations"."property_inspections" USING btree ("tenant_id","source_booking_id","inspection_type") WHERE "rental_operations"."property_inspections"."source_booking_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "property_inspections_tenant_occupancy_type_unique" ON "rental_operations"."property_inspections" USING btree ("tenant_id","occupancy_id","inspection_type") WHERE "rental_operations"."property_inspections"."occupancy_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD CONSTRAINT "property_inspections_status_check" CHECK ("rental_operations"."property_inspections"."lifecycle_status" = 'COMPLETED');--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD CONSTRAINT "property_inspections_provenance_check" CHECK (
    ("rental_operations"."property_inspections"."inspection_type" = 'ENTRY' AND "rental_operations"."property_inspections"."occupancy_id" IS NULL AND (
      ("rental_operations"."property_inspections"."mode" = 'LONG_TERM_RENTAL' AND "rental_operations"."property_inspections"."source_lease_id" IS NOT NULL AND "rental_operations"."property_inspections"."source_booking_id" IS NULL)
      OR ("rental_operations"."property_inspections"."mode" = 'SHORT_TERM_RENTAL' AND "rental_operations"."property_inspections"."source_lease_id" IS NULL AND "rental_operations"."property_inspections"."source_booking_id" IS NOT NULL)))
    OR ("rental_operations"."property_inspections"."inspection_type" = 'EXIT' AND "rental_operations"."property_inspections"."occupancy_id" IS NOT NULL AND "rental_operations"."property_inspections"."source_lease_id" IS NULL AND "rental_operations"."property_inspections"."source_booking_id" IS NULL)
  );
