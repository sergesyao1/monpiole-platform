ALTER TABLE "rental_operations"."bookings" ADD COLUMN "lifecycle_status" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD COLUMN "operational_status" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD COLUMN "operationalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD COLUMN "lifecycle_status" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD COLUMN "lifecycle_status" text;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD COLUMN "actual_check_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD COLUMN "actual_check_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "rental_operations"."bookings" SET "lifecycle_status"='CONFIRMED', "updated_at"="created_at";--> statement-breakpoint
UPDATE "rental_operations"."leases" SET "operational_status"='PREPARING', "operationalized_at"="created_at", "updated_at"="created_at";--> statement-breakpoint
UPDATE "rental_operations"."occupancies" SET "lifecycle_status"=CASE WHEN "ended_at" IS NULL THEN 'ACTIVE' ELSE 'ENDED' END, "updated_at"="created_at";--> statement-breakpoint
UPDATE "rental_operations"."stays" SET "lifecycle_status"='PREPARING', "updated_at"="created_at";--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ALTER COLUMN "lifecycle_status" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ALTER COLUMN "operational_status" SET NOT NULL, ALTER COLUMN "operationalized_at" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ALTER COLUMN "lifecycle_status" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ALTER COLUMN "lifecycle_status" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "occupancies_tenant_lease_unique" ON "rental_operations"."occupancies" USING btree ("tenant_id","source_lease_id") WHERE "rental_operations"."occupancies"."source_lease_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "occupancies_tenant_stay_unique" ON "rental_operations"."occupancies" USING btree ("tenant_id","source_stay_id") WHERE "rental_operations"."occupancies"."source_stay_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ADD CONSTRAINT "bookings_lifecycle_status_check" CHECK ("rental_operations"."bookings"."lifecycle_status" IN ('CONFIRMED', 'IN_STAY', 'COMPLETED', 'CANCELLED', 'NO_SHOW'));--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ADD CONSTRAINT "leases_operational_status_check" CHECK ("rental_operations"."leases"."operational_status" IN ('PREPARING', 'OCCUPIED', 'ENDED', 'CANCELLED'));--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD CONSTRAINT "occupancies_lifecycle_status_check" CHECK (("rental_operations"."occupancies"."lifecycle_status" = 'ACTIVE' AND "rental_operations"."occupancies"."ended_at" IS NULL) OR ("rental_operations"."occupancies"."lifecycle_status" = 'ENDED' AND "rental_operations"."occupancies"."ended_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD CONSTRAINT "stays_lifecycle_status_check" CHECK ("rental_operations"."stays"."lifecycle_status" IN ('PREPARING', 'ACTIVE', 'COMPLETED'));--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD CONSTRAINT "stays_actual_interval_check" CHECK ("rental_operations"."stays"."actual_check_out_at" IS NULL OR ("rental_operations"."stays"."actual_check_in_at" IS NOT NULL AND "rental_operations"."stays"."actual_check_out_at" > "rental_operations"."stays"."actual_check_in_at"));
