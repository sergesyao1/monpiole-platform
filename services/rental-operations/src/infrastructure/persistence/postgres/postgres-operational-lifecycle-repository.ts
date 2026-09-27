import { withTenantPostgresTransaction, type PostgresTransactionScope } from "@monpiole/persistence";
import type { Pool } from "pg";
import { recordRentalOperationsEvent } from "./rental-operations-outbox.js";

import {
  OperationalLifecycleConflictError,
  OperationalSourceNotFoundError,
  type OperationalLifecycleRepository,
  type OperationalLifecycleSnapshot,
} from "../../../application/operational-lifecycle.js";

interface LeaseRow extends Record<string, unknown> {
  readonly lease_id: string;
  readonly rentable_asset_id: string;
  readonly operational_status: "PREPARING" | "OCCUPIED" | "ENDED" | "CANCELLED";
}

interface BookingRow extends Record<string, unknown> {
  readonly booking_id: string;
  readonly rentable_asset_id: string;
  readonly lifecycle_status: "CONFIRMED" | "IN_STAY" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  readonly arrival_at: Date;
  readonly departure_at: Date;
}

interface OccupancyRow extends Record<string, unknown> {
  readonly occupancy_id: string;
  readonly rentable_asset_id: string;
  readonly mode: "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL";
  readonly source_lease_id: string | null;
  readonly source_stay_id: string | null;
  readonly started_at: Date;
  readonly ended_at: Date | null;
}

export class PostgresOperationalLifecycleRepository implements OperationalLifecycleRepository {
  constructor(private readonly pool: Pool) {}

  list(tenantId: string): Promise<readonly OperationalLifecycleSnapshot[]> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const longTerm = await scope.query<LeaseRow & OccupancyRow & { readonly entry_completed: boolean; readonly exit_completed: boolean }>(`SELECT l.lease_id,l.rentable_asset_id,l.operational_status,
        o.occupancy_id,o.mode,o.source_lease_id,o.source_stay_id,o.started_at,o.ended_at,
        EXISTS(SELECT 1 FROM rental_operations.property_inspections i WHERE i.tenant_id=l.tenant_id AND i.source_lease_id=l.lease_id AND i.inspection_type='ENTRY') entry_completed,
        EXISTS(SELECT 1 FROM rental_operations.property_inspections i WHERE i.tenant_id=l.tenant_id AND i.occupancy_id=o.occupancy_id AND i.inspection_type='EXIT') exit_completed
        FROM rental_operations.leases l LEFT JOIN rental_operations.occupancies o ON o.tenant_id=l.tenant_id AND o.source_lease_id=l.lease_id
        WHERE l.tenant_id=$1::uuid ORDER BY l.operationalized_at DESC`, [tenantId]);
      const shortTerm = await scope.query<BookingRow & OccupancyRow & { readonly stay_id: string | null; readonly entry_completed: boolean; readonly exit_completed: boolean }>(`SELECT b.booking_id,b.rentable_asset_id,b.lifecycle_status,b.arrival_at,b.departure_at,s.stay_id,
        o.occupancy_id,o.mode,o.source_lease_id,o.source_stay_id,o.started_at,o.ended_at,
        EXISTS(SELECT 1 FROM rental_operations.property_inspections i WHERE i.tenant_id=b.tenant_id AND i.source_booking_id=b.booking_id AND i.inspection_type='ENTRY') entry_completed,
        EXISTS(SELECT 1 FROM rental_operations.property_inspections i WHERE i.tenant_id=b.tenant_id AND i.occupancy_id=o.occupancy_id AND i.inspection_type='EXIT') exit_completed
        FROM rental_operations.bookings b LEFT JOIN rental_operations.stays s ON s.tenant_id=b.tenant_id AND s.booking_id=b.booking_id
        LEFT JOIN rental_operations.occupancies o ON o.tenant_id=s.tenant_id AND o.source_stay_id=s.stay_id
        WHERE b.tenant_id=$1::uuid ORDER BY b.arrival_at`, [tenantId]);
      return [
        ...longTerm.map((row) => ({ tenantId, rentableAssetId: row.rentable_asset_id, mode: "LONG_TERM_RENTAL" as const,
          leaseId: row.lease_id, leaseStatus: row.operational_status,
          ...(row.occupancy_id === null ? {} : { occupancyId: row.occupancy_id, actualOccupancyStartedAt: row.started_at.toISOString(), ...(row.ended_at === null ? {} : { actualOccupancyEndedAt: row.ended_at.toISOString() }) }),
          capabilities: capabilities(row.operational_status === "PREPARING", row.entry_completed, row.occupancy_id !== null && row.ended_at === null, row.exit_completed) })),
        ...shortTerm.map((row) => ({ tenantId, rentableAssetId: row.rentable_asset_id, mode: "SHORT_TERM_RENTAL" as const,
          bookingId: row.booking_id, bookingStatus: row.lifecycle_status, plannedArrivalAt: row.arrival_at.toISOString(), plannedDepartureAt: row.departure_at.toISOString(),
          ...(row.stay_id === null ? {} : { stayId: row.stay_id }),
          ...(row.occupancy_id === null ? {} : { occupancyId: row.occupancy_id, actualCheckInAt: row.started_at.toISOString(), actualOccupancyStartedAt: row.started_at.toISOString(), ...(row.ended_at === null ? {} : { actualCheckOutAt: row.ended_at.toISOString(), actualOccupancyEndedAt: row.ended_at.toISOString() }) }),
          capabilities: capabilities(row.lifecycle_status === "CONFIRMED", row.entry_completed, row.occupancy_id !== null && row.ended_at === null, row.exit_completed) })),
      ];
    });
  }

  startLeaseOccupancy(input: Readonly<{ tenantId: string; leaseId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const leases = await scope.query<LeaseRow>(`SELECT lease_id, rentable_asset_id, operational_status
        FROM rental_operations.leases WHERE tenant_id=$1::uuid AND lease_id=$2::uuid FOR UPDATE`, [input.tenantId, input.leaseId]);
      const lease = leases[0];
      if (lease === undefined) throw new OperationalSourceNotFoundError();
      const replay = await this.leaseOccupancy(scope, input.tenantId, input.leaseId);
      if (replay !== undefined) {
        if (replay.occupancy_id !== input.occupancyId || replay.started_at.toISOString() !== input.occurredAt) throw new OperationalLifecycleConflictError();
        return leaseSnapshot(input.tenantId, lease, replay);
      }
      if (lease.operational_status !== "PREPARING") throw new OperationalLifecycleConflictError();
      const allocation = await scope.query<{ readonly allocation_id: string }>(`SELECT allocation_id FROM rental_operations.rental_allocations
        WHERE tenant_id=$1::uuid AND source_lease_id=$2::uuid AND rental_mode='LONG_TERM_RENTAL' AND status='ACTIVE' FOR UPDATE`,
      [input.tenantId, input.leaseId]);
      if (allocation[0] === undefined) throw new OperationalLifecycleConflictError();
      await requireInspection(scope, input.tenantId, "source_lease_id", input.leaseId, "ENTRY");
      await scope.query(`INSERT INTO rental_operations.occupancies
        (occupancy_id,tenant_id,rentable_asset_id,mode,source_lease_id,started_at,lifecycle_status,created_at,updated_at)
        VALUES ($1,$2,$3,'LONG_TERM_RENTAL',$4,$5,'ACTIVE',$5,$5)`,
      [input.occupancyId, input.tenantId, lease.rentable_asset_id, input.leaseId, input.occurredAt]);
      await scope.query(`UPDATE rental_operations.leases SET operational_status='OCCUPIED', updated_at=$3
      WHERE tenant_id=$1::uuid AND lease_id=$2::uuid`, [input.tenantId, input.leaseId, input.occurredAt]);
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.occupancy-started",
        aggregateId: input.occupancyId, correlationId: input.occupancyId, occurredAt: input.occurredAt,
        payload: { occupancyId: input.occupancyId, leaseId: input.leaseId, rentableAssetId: lease.rentable_asset_id, mode: "LONG_TERM_RENTAL" } });
      return leaseSnapshot(input.tenantId, { ...lease, operational_status: "OCCUPIED" }, {
        occupancy_id: input.occupancyId, rentable_asset_id: lease.rentable_asset_id, mode: "LONG_TERM_RENTAL",
        source_lease_id: input.leaseId, source_stay_id: null, started_at: new Date(input.occurredAt), ended_at: null,
      });
    });
  }

  startBookingStay(input: Readonly<{ tenantId: string; bookingId: string; stayId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const bookings = await scope.query<BookingRow>(`SELECT booking_id,rentable_asset_id,lifecycle_status,arrival_at,departure_at
        FROM rental_operations.bookings WHERE tenant_id=$1::uuid AND booking_id=$2::uuid FOR UPDATE`, [input.tenantId, input.bookingId]);
      const booking = bookings[0];
      if (booking === undefined) throw new OperationalSourceNotFoundError();
      const existing = await scope.query<OccupancyRow & { readonly stay_id: string; readonly actual_check_in_at: Date }>(`
        SELECT o.*,s.stay_id,s.actual_check_in_at FROM rental_operations.stays s
        JOIN rental_operations.occupancies o ON o.tenant_id=s.tenant_id AND o.source_stay_id=s.stay_id
        WHERE s.tenant_id=$1::uuid AND s.booking_id=$2::uuid`, [input.tenantId, input.bookingId]);
      if (existing[0] !== undefined) {
        if (existing[0].stay_id !== input.stayId || existing[0].occupancy_id !== input.occupancyId || existing[0].actual_check_in_at.toISOString() !== input.occurredAt) throw new OperationalLifecycleConflictError();
        return bookingSnapshot(input.tenantId, booking, existing[0].stay_id, existing[0]);
      }
      if (booking.lifecycle_status !== "CONFIRMED") throw new OperationalLifecycleConflictError();
      await requireInspection(scope, input.tenantId, "source_booking_id", input.bookingId, "ENTRY");
      await scope.query(`INSERT INTO rental_operations.stays
        (stay_id,tenant_id,rentable_asset_id,booking_id,mode,lifecycle_status,actual_check_in_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'SHORT_TERM_RENTAL','ACTIVE',$5,$5,$5)`,
      [input.stayId, input.tenantId, booking.rentable_asset_id, input.bookingId, input.occurredAt]);
      await scope.query(`INSERT INTO rental_operations.occupancies
        (occupancy_id,tenant_id,rentable_asset_id,mode,source_stay_id,started_at,lifecycle_status,created_at,updated_at)
        VALUES ($1,$2,$3,'SHORT_TERM_RENTAL',$4,$5,'ACTIVE',$5,$5)`,
      [input.occupancyId, input.tenantId, booking.rentable_asset_id, input.stayId, input.occurredAt]);
      await scope.query(`UPDATE rental_operations.bookings SET lifecycle_status='IN_STAY',updated_at=$3
      WHERE tenant_id=$1::uuid AND booking_id=$2::uuid`, [input.tenantId, input.bookingId, input.occurredAt]);
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.stay-started",
        aggregateId: input.stayId, correlationId: input.occupancyId, occurredAt: input.occurredAt,
        payload: { stayId: input.stayId, bookingId: input.bookingId, rentableAssetId: booking.rentable_asset_id } });
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.occupancy-started",
        aggregateId: input.occupancyId, correlationId: input.occupancyId, occurredAt: input.occurredAt,
        payload: { occupancyId: input.occupancyId, stayId: input.stayId, rentableAssetId: booking.rentable_asset_id, mode: "SHORT_TERM_RENTAL" } });
      return bookingSnapshot(input.tenantId, { ...booking, lifecycle_status: "IN_STAY" }, input.stayId, {
        occupancy_id: input.occupancyId, rentable_asset_id: booking.rentable_asset_id, mode: "SHORT_TERM_RENTAL",
        source_lease_id: null, source_stay_id: input.stayId, started_at: new Date(input.occurredAt), ended_at: null,
      });
    });
  }

  endOccupancy(input: Readonly<{ tenantId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const rows = await scope.query<OccupancyRow>(`SELECT occupancy_id,rentable_asset_id,mode,source_lease_id,source_stay_id,started_at,ended_at
        FROM rental_operations.occupancies WHERE tenant_id=$1::uuid AND occupancy_id=$2::uuid FOR UPDATE`, [input.tenantId, input.occupancyId]);
      const occupancy = rows[0];
      if (occupancy === undefined) throw new OperationalSourceNotFoundError();
      if (occupancy.ended_at !== null) {
        if (occupancy.ended_at.toISOString() !== input.occurredAt) throw new OperationalLifecycleConflictError();
        return this.snapshotForEnded(scope, input.tenantId, occupancy);
      }
      if (Date.parse(input.occurredAt) <= occupancy.started_at.getTime()) throw new OperationalLifecycleConflictError();
      await requireInspection(scope, input.tenantId, "occupancy_id", input.occupancyId, "EXIT");
      await scope.query(`UPDATE rental_operations.occupancies SET lifecycle_status='ENDED',ended_at=$3,updated_at=$3
      WHERE tenant_id=$1::uuid AND occupancy_id=$2::uuid`, [input.tenantId, input.occupancyId, input.occurredAt]);
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.occupancy-ended",
        aggregateId: input.occupancyId, correlationId: input.occupancyId, occurredAt: input.occurredAt,
        payload: { occupancyId: input.occupancyId, rentableAssetId: occupancy.rentable_asset_id, mode: occupancy.mode } });
      const ended = { ...occupancy, ended_at: new Date(input.occurredAt) };
      if (occupancy.mode === "LONG_TERM_RENTAL") {
        await scope.query(`UPDATE rental_operations.leases SET operational_status='ENDED',updated_at=$3
          WHERE tenant_id=$1::uuid AND lease_id=$2::uuid`, [input.tenantId, occupancy.source_lease_id, input.occurredAt]);
        const allocations = await scope.query<{ readonly allocation_id: string }>(`UPDATE rental_operations.rental_allocations
          SET status='RELEASED',updated_at=$3 WHERE tenant_id=$1::uuid AND source_lease_id=$2::uuid AND status='ACTIVE'
          RETURNING allocation_id`, [input.tenantId, occupancy.source_lease_id, input.occurredAt]);
        for (const allocation of allocations) {
          await scope.query(`UPDATE rental_operations.rental_allocation_claims SET status='RELEASED'
            WHERE tenant_id=$1::uuid AND allocation_id=$2::uuid`, [input.tenantId, allocation.allocation_id]);
          await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.allocation-released",
            aggregateId: allocation.allocation_id, correlationId: input.occupancyId, occurredAt: input.occurredAt,
            payload: { allocationId: allocation.allocation_id, leaseId: occupancy.source_lease_id, rentableAssetId: occupancy.rentable_asset_id } });
        }
      } else {
        await scope.query(`UPDATE rental_operations.stays SET lifecycle_status='COMPLETED',actual_check_out_at=$3,updated_at=$3
          WHERE tenant_id=$1::uuid AND stay_id=$2::uuid`, [input.tenantId, occupancy.source_stay_id, input.occurredAt]);
        await scope.query(`UPDATE rental_operations.bookings b SET lifecycle_status='COMPLETED',updated_at=$3
          FROM rental_operations.stays s WHERE b.tenant_id=$1::uuid AND s.tenant_id=b.tenant_id
          AND s.stay_id=$2::uuid AND b.booking_id=s.booking_id`, [input.tenantId, occupancy.source_stay_id, input.occurredAt]);
        await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.stay-completed",
          aggregateId: occupancy.source_stay_id!, correlationId: input.occupancyId, occurredAt: input.occurredAt,
          payload: { stayId: occupancy.source_stay_id, occupancyId: input.occupancyId, rentableAssetId: occupancy.rentable_asset_id } });
      }
      return this.snapshotForEnded(scope, input.tenantId, ended);
    });
  }

  private async leaseOccupancy(scope: PostgresTransactionScope, tenantId: string, leaseId: string): Promise<OccupancyRow | undefined> {
    return (await scope.query<OccupancyRow>(`SELECT occupancy_id,rentable_asset_id,mode,source_lease_id,source_stay_id,started_at,ended_at
      FROM rental_operations.occupancies WHERE tenant_id=$1::uuid AND source_lease_id=$2::uuid`, [tenantId, leaseId]))[0];
  }

  private async snapshotForEnded(scope: PostgresTransactionScope, tenantId: string, occupancy: OccupancyRow): Promise<OperationalLifecycleSnapshot> {
    if (occupancy.mode === "LONG_TERM_RENTAL") {
      const lease = (await scope.query<LeaseRow>(`SELECT lease_id,rentable_asset_id,operational_status FROM rental_operations.leases
        WHERE tenant_id=$1::uuid AND lease_id=$2::uuid`, [tenantId, occupancy.source_lease_id]))[0]!;
      return leaseSnapshot(tenantId, lease, occupancy);
    }
    const row = (await scope.query<BookingRow & { readonly stay_id: string }>(`SELECT b.booking_id,b.rentable_asset_id,b.lifecycle_status,b.arrival_at,b.departure_at,s.stay_id
      FROM rental_operations.stays s JOIN rental_operations.bookings b ON b.tenant_id=s.tenant_id AND b.booking_id=s.booking_id
      WHERE s.tenant_id=$1::uuid AND s.stay_id=$2::uuid`, [tenantId, occupancy.source_stay_id]))[0]!;
    return bookingSnapshot(tenantId, row, row.stay_id, occupancy);
  }
}

async function requireInspection(
  scope: PostgresTransactionScope,
  tenantId: string,
  sourceColumn: "source_lease_id" | "source_booking_id" | "occupancy_id",
  sourceId: string,
  type: "ENTRY" | "EXIT",
): Promise<void> {
  const rows = await scope.query<{ readonly present: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM rental_operations.property_inspections
    WHERE tenant_id=$1::uuid AND ${sourceColumn}=$2::uuid AND inspection_type=$3 AND lifecycle_status='COMPLETED'
  ) AS present`, [tenantId, sourceId, type]);
  if (!(rows[0]?.present ?? false)) throw new OperationalLifecycleConflictError();
}

function leaseSnapshot(tenantId: string, lease: LeaseRow, occupancy: OccupancyRow): OperationalLifecycleSnapshot {
  return { tenantId, rentableAssetId: lease.rentable_asset_id, mode: "LONG_TERM_RENTAL", leaseId: lease.lease_id,
    leaseStatus: lease.operational_status, occupancyId: occupancy.occupancy_id,
    actualOccupancyStartedAt: occupancy.started_at.toISOString(),
    ...(occupancy.ended_at === null ? {} : { actualOccupancyEndedAt: occupancy.ended_at.toISOString() }) };
}

function bookingSnapshot(tenantId: string, booking: BookingRow, stayId: string, occupancy: OccupancyRow): OperationalLifecycleSnapshot {
  return { tenantId, rentableAssetId: booking.rentable_asset_id, mode: "SHORT_TERM_RENTAL", bookingId: booking.booking_id,
    bookingStatus: booking.lifecycle_status, plannedArrivalAt: booking.arrival_at.toISOString(), plannedDepartureAt: booking.departure_at.toISOString(),
    stayId, actualCheckInAt: occupancy.started_at.toISOString(), occupancyId: occupancy.occupancy_id,
    actualOccupancyStartedAt: occupancy.started_at.toISOString(),
    ...(occupancy.ended_at === null ? {} : { actualCheckOutAt: occupancy.ended_at.toISOString(), actualOccupancyEndedAt: occupancy.ended_at.toISOString() }) };
}

function capabilities(preparing: boolean, entryCompleted: boolean, active: boolean, exitCompleted: boolean) {
  return { canCompleteEntryInspection: preparing && !entryCompleted, canStartOccupancy: preparing && entryCompleted,
    canCompleteExitInspection: active && !exitCompleted, canEndOccupancy: active && exitCompleted };
}
