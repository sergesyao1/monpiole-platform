CREATE SCHEMA "rental_operations";
--> statement-breakpoint
CREATE TABLE "rental_operations"."bookings" (
	"booking_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"arrival_at" timestamp with time zone NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bookings_tenant_booking_pk" PRIMARY KEY("tenant_id","booking_id"),
	CONSTRAINT "bookings_tenant_booking_asset_unique" UNIQUE("tenant_id","booking_id","rentable_asset_id"),
	CONSTRAINT "bookings_mode_check" CHECK ("rental_operations"."bookings"."mode" = 'SHORT_TERM_RENTAL'),
	CONSTRAINT "bookings_interval_check" CHECK ("rental_operations"."bookings"."departure_at" > "rental_operations"."bookings"."arrival_at")
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."leases" (
	"lease_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"source_property_contract_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "leases_tenant_lease_pk" PRIMARY KEY("tenant_id","lease_id"),
	CONSTRAINT "leases_tenant_lease_asset_unique" UNIQUE("tenant_id","lease_id","rentable_asset_id"),
	CONSTRAINT "leases_mode_check" CHECK ("rental_operations"."leases"."mode" = 'LONG_TERM_RENTAL')
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."occupancies" (
	"occupancy_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"source_lease_id" uuid,
	"source_stay_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "occupancies_tenant_occupancy_pk" PRIMARY KEY("tenant_id","occupancy_id"),
	CONSTRAINT "occupancies_tenant_occupancy_mode_unique" UNIQUE("tenant_id","occupancy_id","mode"),
	CONSTRAINT "occupancies_provenance_check" CHECK (
    ("rental_operations"."occupancies"."mode" = 'LONG_TERM_RENTAL' AND "rental_operations"."occupancies"."source_lease_id" IS NOT NULL AND "rental_operations"."occupancies"."source_stay_id" IS NULL)
    OR ("rental_operations"."occupancies"."mode" = 'SHORT_TERM_RENTAL' AND "rental_operations"."occupancies"."source_lease_id" IS NULL AND "rental_operations"."occupancies"."source_stay_id" IS NOT NULL)
  ),
	CONSTRAINT "occupancies_interval_check" CHECK ("rental_operations"."occupancies"."ended_at" IS NULL OR "rental_operations"."occupancies"."ended_at" > "rental_operations"."occupancies"."started_at")
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."operational_blocks" (
	"operational_block_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "operational_blocks_tenant_block_pk" PRIMARY KEY("tenant_id","operational_block_id"),
	CONSTRAINT "operational_blocks_reason_check" CHECK ("rental_operations"."operational_blocks"."reason" IN ('MAINTENANCE', 'OWNER_USE', 'CLEANING', 'INSPECTION', 'RENOVATION', 'ADMINISTRATIVE', 'OTHER')),
	CONSTRAINT "operational_blocks_interval_check" CHECK ("rental_operations"."operational_blocks"."end_at" > "rental_operations"."operational_blocks"."start_at")
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."operational_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."property_inspections" (
	"inspection_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"occupancy_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"inspection_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "property_inspections_tenant_inspection_pk" PRIMARY KEY("tenant_id","inspection_id"),
	CONSTRAINT "property_inspections_mode_check" CHECK ("rental_operations"."property_inspections"."mode" IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL')),
	CONSTRAINT "property_inspections_type_check" CHECK ("rental_operations"."property_inspections"."inspection_type" IN ('ENTRY', 'EXIT'))
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."rental_allocations" (
	"allocation_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"allocation_type" text NOT NULL,
	"source_lease_id" uuid,
	"source_booking_id" uuid,
	"source_operational_block_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rental_allocations_tenant_allocation_pk" PRIMARY KEY("tenant_id","allocation_id"),
	CONSTRAINT "rental_allocations_provenance_check" CHECK (
    ("rental_operations"."rental_allocations"."allocation_type" = 'LEASE' AND "rental_operations"."rental_allocations"."source_lease_id" IS NOT NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NULL)
    OR ("rental_operations"."rental_allocations"."allocation_type" = 'BOOKING' AND "rental_operations"."rental_allocations"."source_lease_id" IS NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NOT NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NULL AND "rental_operations"."rental_allocations"."end_at" IS NOT NULL)
    OR ("rental_operations"."rental_allocations"."allocation_type" = 'OPERATIONAL_BLOCK' AND "rental_operations"."rental_allocations"."source_lease_id" IS NULL AND "rental_operations"."rental_allocations"."source_booking_id" IS NULL AND "rental_operations"."rental_allocations"."source_operational_block_id" IS NOT NULL AND "rental_operations"."rental_allocations"."end_at" IS NOT NULL)
  ),
	CONSTRAINT "rental_allocations_interval_check" CHECK ("rental_operations"."rental_allocations"."end_at" IS NULL OR "rental_operations"."rental_allocations"."end_at" > "rental_operations"."rental_allocations"."start_at")
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_operations"."stays" (
	"stay_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rentable_asset_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stays_tenant_stay_pk" PRIMARY KEY("tenant_id","stay_id"),
	CONSTRAINT "stays_tenant_stay_asset_unique" UNIQUE("tenant_id","stay_id","rentable_asset_id"),
	CONSTRAINT "stays_mode_check" CHECK ("rental_operations"."stays"."mode" = 'SHORT_TERM_RENTAL')
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD CONSTRAINT "occupancies_lease_tenant_fk" FOREIGN KEY ("tenant_id","source_lease_id","rentable_asset_id") REFERENCES "rental_operations"."leases"("tenant_id","lease_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."occupancies" ADD CONSTRAINT "occupancies_stay_tenant_fk" FOREIGN KEY ("tenant_id","source_stay_id","rentable_asset_id") REFERENCES "rental_operations"."stays"("tenant_id","stay_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."property_inspections" ADD CONSTRAINT "property_inspections_occupancy_tenant_fk" FOREIGN KEY ("tenant_id","occupancy_id","mode") REFERENCES "rental_operations"."occupancies"("tenant_id","occupancy_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_lease_tenant_fk" FOREIGN KEY ("tenant_id","source_lease_id") REFERENCES "rental_operations"."leases"("tenant_id","lease_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_booking_tenant_fk" FOREIGN KEY ("tenant_id","source_booking_id") REFERENCES "rental_operations"."bookings"("tenant_id","booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."rental_allocations" ADD CONSTRAINT "rental_allocations_block_tenant_fk" FOREIGN KEY ("tenant_id","source_operational_block_id") REFERENCES "rental_operations"."operational_blocks"("tenant_id","operational_block_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_operations"."stays" ADD CONSTRAINT "stays_booking_tenant_fk" FOREIGN KEY ("tenant_id","booking_id","rentable_asset_id") REFERENCES "rental_operations"."bookings"("tenant_id","booking_id","rentable_asset_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_tenant_asset_arrival_idx" ON "rental_operations"."bookings" USING btree ("tenant_id","rentable_asset_id","arrival_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leases_tenant_contract_unique" ON "rental_operations"."leases" USING btree ("tenant_id","source_property_contract_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_asset_idx" ON "rental_operations"."leases" USING btree ("tenant_id","rentable_asset_id");--> statement-breakpoint
CREATE INDEX "occupancies_tenant_asset_started_idx" ON "rental_operations"."occupancies" USING btree ("tenant_id","rentable_asset_id","started_at");--> statement-breakpoint
CREATE INDEX "operational_blocks_tenant_asset_start_idx" ON "rental_operations"."operational_blocks" USING btree ("tenant_id","rentable_asset_id","start_at");--> statement-breakpoint
CREATE INDEX "property_inspections_tenant_occupancy_idx" ON "rental_operations"."property_inspections" USING btree ("tenant_id","occupancy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_allocations_tenant_lease_unique" ON "rental_operations"."rental_allocations" USING btree ("tenant_id","source_lease_id") WHERE "rental_operations"."rental_allocations"."source_lease_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_allocations_tenant_booking_unique" ON "rental_operations"."rental_allocations" USING btree ("tenant_id","source_booking_id") WHERE "rental_operations"."rental_allocations"."source_booking_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_allocations_tenant_block_unique" ON "rental_operations"."rental_allocations" USING btree ("tenant_id","source_operational_block_id") WHERE "rental_operations"."rental_allocations"."source_operational_block_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "rental_allocations_tenant_asset_start_idx" ON "rental_operations"."rental_allocations" USING btree ("tenant_id","rentable_asset_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stays_tenant_booking_unique" ON "rental_operations"."stays" USING btree ("tenant_id","booking_id");--> statement-breakpoint
CREATE POLICY "bookings_tenant_isolation" ON "rental_operations"."bookings" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."bookings"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."bookings"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "leases_tenant_isolation" ON "rental_operations"."leases" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."leases"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."leases"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "occupancies_tenant_isolation" ON "rental_operations"."occupancies" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."occupancies"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."occupancies"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "operational_blocks_tenant_isolation" ON "rental_operations"."operational_blocks" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."operational_blocks"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."operational_blocks"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "property_inspections_tenant_isolation" ON "rental_operations"."property_inspections" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."property_inspections"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."property_inspections"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "rental_allocations_tenant_isolation" ON "rental_operations"."rental_allocations" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."rental_allocations"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."rental_allocations"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "stays_tenant_isolation" ON "rental_operations"."stays" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."stays"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."stays"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "rental_operations"."leases" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."bookings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."stays" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."occupancies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."property_inspections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."operational_blocks" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rental_operations"."rental_allocations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "rental_operations" TO "monpiole_runtime";
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA "rental_operations" TO "monpiole_runtime";
