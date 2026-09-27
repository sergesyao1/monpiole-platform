import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const rentalOperations = pgSchema("rental_operations");
const tenantPolicy = (tenantId: AnyPgColumn) => ({
  using: sql`${tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  withCheck: sql`${tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
});

export const leases = rentalOperations.table("leases", {
  leaseId: uuid("lease_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  sourcePropertyContractId: uuid("source_property_contract_id").notNull(),
  mode: text("mode").notNull(),
  operationalStatus: text("operational_status").notNull(),
  operationalizedAt: timestamp("operationalized_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "leases_tenant_lease_pk", columns: [table.tenantId, table.leaseId] }),
  unique("leases_tenant_lease_asset_unique").on(table.tenantId, table.leaseId, table.rentableAssetId),
  uniqueIndex("leases_tenant_contract_unique").on(table.tenantId, table.sourcePropertyContractId),
  index("leases_tenant_asset_idx").on(table.tenantId, table.rentableAssetId),
  check("leases_mode_check", sql`${table.mode} = 'LONG_TERM_RENTAL'`),
  check("leases_operational_status_check", sql`${table.operationalStatus} IN ('PREPARING', 'OCCUPIED', 'ENDED', 'CANCELLED')`),
  pgPolicy("leases_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const bookings = rentalOperations.table("bookings", {
  bookingId: uuid("booking_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  mode: text("mode").notNull(),
  lifecycleStatus: text("lifecycle_status").notNull(),
  arrivalAt: timestamp("arrival_at", { withTimezone: true, mode: "string" }).notNull(),
  departureAt: timestamp("departure_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "bookings_tenant_booking_pk", columns: [table.tenantId, table.bookingId] }),
  unique("bookings_tenant_booking_asset_unique").on(table.tenantId, table.bookingId, table.rentableAssetId),
  index("bookings_tenant_asset_arrival_idx").on(table.tenantId, table.rentableAssetId, table.arrivalAt),
  check("bookings_mode_check", sql`${table.mode} = 'SHORT_TERM_RENTAL'`),
  check("bookings_lifecycle_status_check", sql`${table.lifecycleStatus} IN ('CONFIRMED', 'IN_STAY', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`),
  check("bookings_interval_check", sql`${table.departureAt} > ${table.arrivalAt}`),
  pgPolicy("bookings_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const stays = rentalOperations.table("stays", {
  stayId: uuid("stay_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  bookingId: uuid("booking_id").notNull(),
  mode: text("mode").notNull(),
  lifecycleStatus: text("lifecycle_status").notNull(),
  actualCheckInAt: timestamp("actual_check_in_at", { withTimezone: true, mode: "string" }),
  actualCheckOutAt: timestamp("actual_check_out_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "stays_tenant_stay_pk", columns: [table.tenantId, table.stayId] }),
  unique("stays_tenant_stay_asset_unique").on(table.tenantId, table.stayId, table.rentableAssetId),
  uniqueIndex("stays_tenant_booking_unique").on(table.tenantId, table.bookingId),
  foreignKey({
    name: "stays_booking_tenant_fk",
    columns: [table.tenantId, table.bookingId, table.rentableAssetId],
    foreignColumns: [bookings.tenantId, bookings.bookingId, bookings.rentableAssetId],
  }),
  check("stays_mode_check", sql`${table.mode} = 'SHORT_TERM_RENTAL'`),
  check("stays_lifecycle_status_check", sql`${table.lifecycleStatus} IN ('PREPARING', 'ACTIVE', 'COMPLETED')`),
  check("stays_actual_interval_check", sql`${table.actualCheckOutAt} IS NULL OR (${table.actualCheckInAt} IS NOT NULL AND ${table.actualCheckOutAt} > ${table.actualCheckInAt})`),
  pgPolicy("stays_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const occupancies = rentalOperations.table("occupancies", {
  occupancyId: uuid("occupancy_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  mode: text("mode").notNull(),
  sourceLeaseId: uuid("source_lease_id"),
  sourceStayId: uuid("source_stay_id"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  lifecycleStatus: text("lifecycle_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "occupancies_tenant_occupancy_pk", columns: [table.tenantId, table.occupancyId] }),
  unique("occupancies_tenant_occupancy_mode_unique").on(table.tenantId, table.occupancyId, table.mode),
  index("occupancies_tenant_asset_started_idx").on(table.tenantId, table.rentableAssetId, table.startedAt),
  uniqueIndex("occupancies_tenant_lease_unique").on(table.tenantId, table.sourceLeaseId).where(sql`${table.sourceLeaseId} IS NOT NULL`),
  uniqueIndex("occupancies_tenant_stay_unique").on(table.tenantId, table.sourceStayId).where(sql`${table.sourceStayId} IS NOT NULL`),
  foreignKey({ name: "occupancies_lease_tenant_fk", columns: [table.tenantId, table.sourceLeaseId, table.rentableAssetId], foreignColumns: [leases.tenantId, leases.leaseId, leases.rentableAssetId] }),
  foreignKey({ name: "occupancies_stay_tenant_fk", columns: [table.tenantId, table.sourceStayId, table.rentableAssetId], foreignColumns: [stays.tenantId, stays.stayId, stays.rentableAssetId] }),
  check("occupancies_provenance_check", sql`
    (${table.mode} = 'LONG_TERM_RENTAL' AND ${table.sourceLeaseId} IS NOT NULL AND ${table.sourceStayId} IS NULL)
    OR (${table.mode} = 'SHORT_TERM_RENTAL' AND ${table.sourceLeaseId} IS NULL AND ${table.sourceStayId} IS NOT NULL)
  `),
  check("occupancies_interval_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} > ${table.startedAt}`),
  check("occupancies_lifecycle_status_check", sql`(${table.lifecycleStatus} = 'ACTIVE' AND ${table.endedAt} IS NULL) OR (${table.lifecycleStatus} = 'ENDED' AND ${table.endedAt} IS NOT NULL)`),
  pgPolicy("occupancies_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const propertyInspections = rentalOperations.table("property_inspections", {
  inspectionId: uuid("inspection_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  occupancyId: uuid("occupancy_id"),
  sourceLeaseId: uuid("source_lease_id"),
  sourceBookingId: uuid("source_booking_id"),
  mode: text("mode").notNull(),
  inspectionType: text("inspection_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
  lifecycleStatus: text("lifecycle_status").notNull(),
  responsibleActorId: text("responsible_actor_id").notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  conditionRecords: jsonb("condition_records").notNull(),
  evidenceReferences: jsonb("evidence_references").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "property_inspections_tenant_inspection_pk", columns: [table.tenantId, table.inspectionId] }),
  index("property_inspections_tenant_occupancy_idx").on(table.tenantId, table.occupancyId),
  uniqueIndex("property_inspections_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
  uniqueIndex("property_inspections_tenant_lease_type_unique").on(table.tenantId, table.sourceLeaseId, table.inspectionType).where(sql`${table.sourceLeaseId} IS NOT NULL`),
  uniqueIndex("property_inspections_tenant_booking_type_unique").on(table.tenantId, table.sourceBookingId, table.inspectionType).where(sql`${table.sourceBookingId} IS NOT NULL`),
  uniqueIndex("property_inspections_tenant_occupancy_type_unique").on(table.tenantId, table.occupancyId, table.inspectionType).where(sql`${table.occupancyId} IS NOT NULL`),
  foreignKey({ name: "property_inspections_occupancy_tenant_fk", columns: [table.tenantId, table.occupancyId, table.mode], foreignColumns: [occupancies.tenantId, occupancies.occupancyId, occupancies.mode] }),
  foreignKey({ name: "property_inspections_lease_tenant_fk", columns: [table.tenantId, table.sourceLeaseId, table.rentableAssetId], foreignColumns: [leases.tenantId, leases.leaseId, leases.rentableAssetId] }),
  foreignKey({ name: "property_inspections_booking_tenant_fk", columns: [table.tenantId, table.sourceBookingId, table.rentableAssetId], foreignColumns: [bookings.tenantId, bookings.bookingId, bookings.rentableAssetId] }),
  check("property_inspections_mode_check", sql`${table.mode} IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL')`),
  check("property_inspections_type_check", sql`${table.inspectionType} IN ('ENTRY', 'EXIT')`),
  check("property_inspections_status_check", sql`${table.lifecycleStatus} = 'COMPLETED'`),
  check("property_inspections_provenance_check", sql`
    (${table.inspectionType} = 'ENTRY' AND ${table.occupancyId} IS NULL AND (
      (${table.mode} = 'LONG_TERM_RENTAL' AND ${table.sourceLeaseId} IS NOT NULL AND ${table.sourceBookingId} IS NULL)
      OR (${table.mode} = 'SHORT_TERM_RENTAL' AND ${table.sourceLeaseId} IS NULL AND ${table.sourceBookingId} IS NOT NULL)))
    OR (${table.inspectionType} = 'EXIT' AND ${table.occupancyId} IS NOT NULL AND ${table.sourceLeaseId} IS NULL AND ${table.sourceBookingId} IS NULL)
  `),
  pgPolicy("property_inspections_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const operationalBlocks = rentalOperations.table("operational_blocks", {
  operationalBlockId: uuid("operational_block_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  status: text("status").notNull(),
  startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  completedByActorId: text("completed_by_actor_id"),
}, (table) => [
  primaryKey({ name: "operational_blocks_tenant_block_pk", columns: [table.tenantId, table.operationalBlockId] }),
  unique("operational_blocks_tenant_block_asset_unique").on(table.tenantId, table.operationalBlockId, table.rentableAssetId),
  index("operational_blocks_tenant_asset_start_idx").on(table.tenantId, table.rentableAssetId, table.startAt),
  uniqueIndex("operational_blocks_tenant_source_reason_unique").on(table.tenantId, table.sourceType, table.sourceId, table.reason).where(sql`${table.sourceId} IS NOT NULL`),
  check("operational_blocks_reason_check", sql`${table.reason} IN ('MAINTENANCE', 'OWNER_USE', 'CLEANING', 'PREPARATION', 'INSPECTION', 'RENOVATION', 'ADMINISTRATIVE_BLOCK', 'OTHER')`),
  check("operational_blocks_interval_check", sql`${table.endAt} > ${table.startAt}`),
  check("operational_blocks_status_check", sql`${table.status} IN ('ACTIVE', 'RELEASED')`),
  check("operational_blocks_source_check", sql`(${table.sourceType} IS NULL) = (${table.sourceId} IS NULL)`),
  check("operational_blocks_note_check", sql`${table.note} IS NULL OR char_length(btrim(${table.note})) BETWEEN 1 AND 2000`),
  check("operational_blocks_timestamps_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  check("operational_blocks_completion_check", sql`(${table.status} = 'ACTIVE' AND ${table.completedAt} IS NULL AND ${table.completedByActorId} IS NULL) OR (${table.status} = 'RELEASED' AND ${table.completedAt} IS NOT NULL AND ${table.completedByActorId} IS NOT NULL)`),
  pgPolicy("operational_blocks_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const rentalAllocations = rentalOperations.table("rental_allocations", {
  allocationId: uuid("allocation_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  rentableAssetId: uuid("rentable_asset_id").notNull(),
  allocationType: text("allocation_type").notNull(),
  rentalMode: text("rental_mode"),
  sourceLeaseId: uuid("source_lease_id"),
  sourceBookingId: uuid("source_booking_id"),
  sourceOperationalBlockId: uuid("source_operational_block_id"),
  startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "string" }),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ name: "rental_allocations_tenant_allocation_pk", columns: [table.tenantId, table.allocationId] }),
  uniqueIndex("rental_allocations_tenant_lease_unique").on(table.tenantId, table.sourceLeaseId).where(sql`${table.sourceLeaseId} IS NOT NULL`),
  uniqueIndex("rental_allocations_tenant_booking_unique").on(table.tenantId, table.sourceBookingId).where(sql`${table.sourceBookingId} IS NOT NULL`),
  uniqueIndex("rental_allocations_tenant_block_unique").on(table.tenantId, table.sourceOperationalBlockId).where(sql`${table.sourceOperationalBlockId} IS NOT NULL`),
  index("rental_allocations_tenant_asset_start_idx").on(table.tenantId, table.rentableAssetId, table.startAt),
  foreignKey({ name: "rental_allocations_lease_tenant_fk", columns: [table.tenantId, table.sourceLeaseId, table.rentableAssetId], foreignColumns: [leases.tenantId, leases.leaseId, leases.rentableAssetId] }),
  foreignKey({ name: "rental_allocations_booking_tenant_fk", columns: [table.tenantId, table.sourceBookingId, table.rentableAssetId], foreignColumns: [bookings.tenantId, bookings.bookingId, bookings.rentableAssetId] }),
  foreignKey({ name: "rental_allocations_block_tenant_fk", columns: [table.tenantId, table.sourceOperationalBlockId, table.rentableAssetId], foreignColumns: [operationalBlocks.tenantId, operationalBlocks.operationalBlockId, operationalBlocks.rentableAssetId] }),
  check("rental_allocations_provenance_check", sql`
    (${table.allocationType} = 'LEASE' AND ${table.rentalMode} = 'LONG_TERM_RENTAL' AND ${table.sourceLeaseId} IS NOT NULL AND ${table.sourceBookingId} IS NULL AND ${table.sourceOperationalBlockId} IS NULL)
    OR (${table.allocationType} = 'BOOKING' AND ${table.rentalMode} = 'SHORT_TERM_RENTAL' AND ${table.sourceLeaseId} IS NULL AND ${table.sourceBookingId} IS NOT NULL AND ${table.sourceOperationalBlockId} IS NULL AND ${table.endAt} IS NOT NULL)
    OR (${table.allocationType} = 'OPERATIONAL_BLOCK' AND ${table.sourceLeaseId} IS NULL AND ${table.sourceBookingId} IS NULL AND ${table.sourceOperationalBlockId} IS NOT NULL AND ${table.endAt} IS NOT NULL)
  `),
  check("rental_allocations_interval_check", sql`${table.endAt} IS NULL OR ${table.endAt} > ${table.startAt}`),
  check("rental_allocations_mode_check", sql`${table.rentalMode} IS NULL OR ${table.rentalMode} IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL')`),
  check("rental_allocations_status_check", sql`${table.status} IN ('ACTIVE', 'RELEASED')`),
  check("rental_allocations_timestamps_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  pgPolicy("rental_allocations_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();

export const rentalAllocationClaims = rentalOperations.table("rental_allocation_claims", {
  tenantId: uuid("tenant_id").notNull(),
  allocationId: uuid("allocation_id").notNull(),
  conflictScopeId: uuid("conflict_scope_id").notNull(),
  startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "string" }),
  status: text("status").notNull(),
}, (table) => [
  primaryKey({ name: "rental_allocation_claims_pk", columns: [table.tenantId, table.allocationId, table.conflictScopeId] }),
  foreignKey({ name: "rental_allocation_claims_allocation_tenant_fk", columns: [table.tenantId, table.allocationId], foreignColumns: [rentalAllocations.tenantId, rentalAllocations.allocationId] }),
  index("rental_allocation_claims_tenant_scope_start_idx").on(table.tenantId, table.conflictScopeId, table.startAt),
  check("rental_allocation_claims_interval_check", sql`${table.endAt} IS NULL OR ${table.endAt} > ${table.startAt}`),
  check("rental_allocation_claims_status_check", sql`${table.status} IN ('ACTIVE', 'RELEASED')`),
  pgPolicy("rental_allocation_claims_tenant_isolation", tenantPolicy(table.tenantId)),
]).enableRLS();
