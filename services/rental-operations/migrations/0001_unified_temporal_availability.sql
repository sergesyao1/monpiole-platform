CREATE TABLE "rental_operations"."rental_allocation_claims" (
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"conflict_scope_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"status" text NOT NULL,
	CONSTRAINT "rental_allocation_claims_pk" PRIMARY KEY("tenant_id","allocation_id","conflict_scope_id"),
	CONSTRAINT "rental_allocation_claims_interval_check" CHECK ("rental_operations"."rental_allocation_claims"."end_at" IS NULL OR "rental_operations"."rental_allocation_claims"."end_at" > "rental_operations"."rental_allocation_claims"."start_at"),
	CONSTRAINT "rental_allocation_claims_status_check" CHECK ("rental_operations"."rental_allocation_claims"."status" IN ('ACTIVE', 'RELEASED'))
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocation_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" DROP CONSTRAINT "operational_blocks_reason_check";--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" DROP CONSTRAINT "rental_allocations_provenance_check";--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" DROP CONSTRAINT "rental_allocations_lease_tenant_fk";
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" DROP CONSTRAINT "rental_allocations_booking_tenant_fk";
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" DROP CONSTRAINT "rental_allocations_block_tenant_fk";
--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD COLUMN "status" text NOT NULL DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD COLUMN "rental_mode" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD COLUMN "status" text NOT NULL DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "rental_operations"."operational_blocks"
SET "reason" = 'ADMINISTRATIVE_BLOCK' WHERE "reason" = 'ADMINISTRATIVE';
UPDATE "rental_operations"."operational_blocks" SET "updated_at" = "created_at";
UPDATE "rental_operations"."rental_allocations"
SET "rental_mode" = CASE
  WHEN "allocation_type" = 'LEASE' THEN 'LONG_TERM_RENTAL'
  WHEN "allocation_type" = 'BOOKING' THEN 'SHORT_TERM_RENTAL'
  ELSE NULL
END, "updated_at" = "created_at";
ALTER TABLE "rental_operations"."operational_blocks" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "rental_operations"."rental_allocations" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "rental_operations"."operational_blocks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "rental_operations"."rental_allocations" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocation_claims" ADD CONSTRAINT "rental_allocation_claims_allocation_tenant_fk" FOREIGN KEY ("tenant_id","allocation_id") REFERENCES "rental_operations"."rental_allocations"("tenant_id","allocation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_allocation_claims_tenant_scope_start_idx" ON "rental_operations"."rental_allocation_claims" USING btree ("tenant_id","conflict_scope_id","start_at");--> statement-breakpoint
INSERT INTO "rental_operations"."rental_allocation_claims"
  ("tenant_id", "allocation_id", "conflict_scope_id", "start_at", "end_at", "status")
SELECT "tenant_id", "allocation_id", "rentable_asset_id", "start_at", "end_at", "status"
FROM "rental_operations"."rental_allocations";
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_lease_tenant_fk" FOREIGN KEY ("tenant_id","source_lease_id","rentable_asset_id") REFERENCES "rental_operations"."leases"("tenant_id","lease_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_booking_tenant_fk" FOREIGN KEY ("tenant_id","source_booking_id","rentable_asset_id") REFERENCES "rental_operations"."bookings"("tenant_id","booking_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_tenant_block_asset_unique" UNIQUE("tenant_id","operational_block_id","rentable_asset_id");--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_block_tenant_fk" FOREIGN KEY ("tenant_id","source_operational_block_id","rentable_asset_id") REFERENCES "rental_operations"."operational_blocks"("tenant_id","operational_block_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_status_check" CHECK ("rental_operations"."operational_blocks"."status" IN ('ACTIVE', 'RELEASED'));--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_source_check" CHECK (("rental_operations"."operational_blocks"."source_type" IS NULL) = ("rental_operations"."operational_blocks"."source_id" IS NULL));--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_note_check" CHECK ("rental_operations"."operational_blocks"."note" IS NULL OR char_length(btrim("rental_operations"."operational_blocks"."note")) BETWEEN 1 AND 2000);--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_timestamps_check" CHECK ("rental_operations"."operational_blocks"."updated_at" >= "rental_operations"."operational_blocks"."created_at");--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ADD CONSTRAINT "operational_blocks_reason_check" CHECK ("rental_operations"."operational_blocks"."reason" IN ('MAINTENANCE', 'OWNER_USE', 'CLEANING', 'PREPARATION', 'INSPECTION', 'RENOVATION', 'ADMINISTRATIVE_BLOCK', 'OTHER'));--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_mode_check" CHECK ("rental_operations"."rental_allocations"."rental_mode" IS NULL OR "rental_operations"."rental_allocations"."rental_mode" IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL'));--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_status_check" CHECK ("rental_operations"."rental_allocations"."status" IN ('ACTIVE', 'RELEASED'));--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_timestamps_check" CHECK ("rental_operations"."rental_allocations"."updated_at" >= "rental_operations"."rental_allocations"."created_at");--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_provenance_check" CHECK (
    ("rental_operations"."rental_allocations"."allocation_type" = 'LEASE' AND "rental_operations"."rental_allocations"."rental_mode" = 'LONG_TERM_RENTAL' AND "rental_operations"."rental_allocations"."source_lease_id" IS NOT NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NULL)
    OR ("rental_operations"."rental_allocations"."allocation_type" = 'BOOKING' AND "rental_operations"."rental_allocations"."rental_mode" = 'SHORT_TERM_RENTAL' AND "rental_operations"."rental_allocations"."source_lease_id" IS NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NOT NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NULL AND "rental_operations"."rental_allocations"."end_at" IS NOT NULL)
    OR ("rental_operations"."rental_allocations"."allocation_type" = 'OPERATIONAL_BLOCK' AND "rental_operations"."rental_allocations"."source_lease_id" IS NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NOT NULL AND "rental_operations"."rental_allocations"."end_at" IS NOT NULL)
  );--> statement-breakpoint
CREATE POLICY "rental_allocation_claims_tenant_isolation" ON "rental_operations"."rental_allocation_claims" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."rental_allocation_claims"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."rental_allocation_claims"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocation_claims" FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE "rental_operations"."rental_allocation_claims" TO "monpiole_runtime";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "rental_operations"."rental_allocation_claims"
ADD CONSTRAINT "rental_allocation_claims_no_active_overlap"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "conflict_scope_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("status" = 'ACTIVE');
