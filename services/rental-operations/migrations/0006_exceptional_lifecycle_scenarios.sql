ALTER TABLE "rental_operations"."occupancies" DROP CONSTRAINT "occupancies_lifecycle_status_check";--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD COLUMN "original_departure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD COLUMN "closure_reason" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD COLUMN "closure_reason" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD COLUMN "end_reason" text;--> statement-breakpoint
UPDATE "rental_operations"."bookings" SET "original_departure_at" = "departure_at" WHERE "original_departure_at" IS NULL;--> statement-breakpoint
UPDATE "rental_operations"."bookings" SET "closed_at" = "updated_at", "closure_reason" = 'legacy-migration' WHERE "lifecycle_status" IN ('CANCELLED', 'NO_SHOW');--> statement-breakpoint
UPDATE "rental_operations"."leases" SET "closed_at" = "updated_at", "closure_reason" = 'legacy-migration' WHERE "operational_status" = 'CANCELLED';--> statement-breakpoint
UPDATE "rental_operations"."occupancies" SET "end_reason" = 'SCHEDULED' WHERE "lifecycle_status" = 'ENDED';--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ALTER COLUMN "original_departure_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD CONSTRAINT "bookings_original_interval_check" CHECK ("rental_operations"."bookings"."original_departure_at" > "rental_operations"."bookings"."arrival_at");--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD CONSTRAINT "bookings_closure_check" CHECK (("rental_operations"."bookings"."lifecycle_status" IN ('CANCELLED', 'NO_SHOW')) = ("rental_operations"."bookings"."closed_at" IS NOT NULL AND "rental_operations"."bookings"."closure_reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD CONSTRAINT "leases_closure_check" CHECK (("rental_operations"."leases"."operational_status" = 'CANCELLED') = ("rental_operations"."leases"."closed_at" IS NOT NULL AND "rental_operations"."leases"."closure_reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD CONSTRAINT "occupancies_lifecycle_status_check" CHECK (("rental_operations"."occupancies"."lifecycle_status" = 'ACTIVE' AND "rental_operations"."occupancies"."ended_at" IS NULL AND "rental_operations"."occupancies"."end_reason" IS NULL) OR ("rental_operations"."occupancies"."lifecycle_status" = 'ENDED' AND "rental_operations"."occupancies"."ended_at" IS NOT NULL AND "rental_operations"."occupancies"."end_reason" IN ('SCHEDULED', 'EARLY_DEPARTURE', 'EARLY_TERMINATION', 'OVERSTAY')));
--> statement-breakpoint
ALTER TABLE "rental_operations"."outbox" DROP CONSTRAINT "rental_operations_outbox_event_check";--> statement-breakpoint
ALTER TABLE "rental_operations"."outbox" ADD CONSTRAINT "rental_operations_outbox_event_check" CHECK ("rental_operations"."outbox"."event_type" IN (
  'monpiole.rental-operations.stay-started', 'monpiole.rental-operations.stay-completed',
  'monpiole.rental-operations.occupancy-started', 'monpiole.rental-operations.occupancy-ended',
  'monpiole.rental-operations.entry-inspection-completed', 'monpiole.rental-operations.exit-inspection-completed',
  'monpiole.rental-operations.allocation-created', 'monpiole.rental-operations.allocation-released',
  'monpiole.rental-operations.operational-block-created', 'monpiole.rental-operations.operational-block-released',
  'monpiole.rental-operations.operational-block-extended',
  'monpiole.rental-operations.booking-cancelled', 'monpiole.rental-operations.booking-no-show-recorded',
  'monpiole.rental-operations.booking-extended', 'monpiole.rental-operations.lease-cancelled',
  'monpiole.rental-operations.lease-renewed'
) AND "rental_operations"."outbox"."event_version" = '1');
