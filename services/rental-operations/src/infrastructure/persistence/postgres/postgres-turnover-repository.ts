import { withTenantPostgresTransaction, type PostgresTransactionScope } from "@monpiole/persistence";
import type { Pool } from "pg";

import { OperationalLifecycleConflictError, OperationalSourceNotFoundError } from "../../../application/operational-lifecycle.js";
import type { TurnoverRepository, TurnoverSnapshot } from "../../../application/turnover-lifecycle.js";
import { recordRentalOperationsEvent } from "./rental-operations-outbox.js";

interface CheckoutSource extends Record<string, unknown> {
  readonly occupancy_id: string;
  readonly stay_id: string;
  readonly booking_id: string;
  readonly rentable_asset_id: string;
  readonly started_at: Date;
  readonly ended_at: Date | null;
}

interface TurnoverRow extends Record<string, unknown> {
  readonly operational_block_id: string;
  readonly status: "ACTIVE" | "RELEASED";
  readonly start_at: Date;
  readonly end_at: Date;
  readonly completed_at: Date | null;
  readonly completed_by_actor_id: string | null;
  readonly source_id: string;
  readonly occupancy_id: string;
  readonly booking_id: string;
  readonly rentable_asset_id: string;
}

export class PostgresTurnoverRepository implements TurnoverRepository {
  constructor(private readonly pool: Pool) {}

  checkout(input: Readonly<{ tenantId: string; actorId: string; occupancyId: string; operationalBlockId: string; allocationId: string; checkedOutAt: string; expectedCleaningCompletionAt: string; conflictScopeIds: readonly string[] }>): Promise<TurnoverSnapshot> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const source = (await scope.query<CheckoutSource>(`SELECT o.occupancy_id,o.rentable_asset_id,o.started_at,o.ended_at,s.stay_id,s.booking_id
        FROM rental_operations.occupancies o JOIN rental_operations.stays s ON s.tenant_id=o.tenant_id AND s.stay_id=o.source_stay_id
        WHERE o.tenant_id=$1::uuid AND o.occupancy_id=$2::uuid AND o.mode='SHORT_TERM_RENTAL' FOR UPDATE OF o,s`,
      [input.tenantId, input.occupancyId]))[0];
      if (source === undefined) throw new OperationalSourceNotFoundError();
      const replay = await findTurnover(scope, input.tenantId, source.stay_id);
      if (replay !== undefined) {
        if (replay.operational_block_id !== input.operationalBlockId || replay.start_at.toISOString() !== input.checkedOutAt
          || replay.end_at.toISOString() !== input.expectedCleaningCompletionAt) throw new OperationalLifecycleConflictError();
        return toSnapshot(replay);
      }
      if (source.ended_at !== null || Date.parse(input.expectedCleaningCompletionAt) <= Date.parse(input.checkedOutAt)
        || Date.parse(input.checkedOutAt) <= source.started_at.getTime()) throw new OperationalLifecycleConflictError();
      const exit = await scope.query<{ readonly present: boolean }>(`SELECT EXISTS (SELECT 1 FROM rental_operations.property_inspections
        WHERE tenant_id=$1::uuid AND occupancy_id=$2::uuid AND inspection_type='EXIT' AND lifecycle_status='COMPLETED') AS present`,
      [input.tenantId, input.occupancyId]);
      if (!(exit[0]?.present ?? false)) throw new OperationalLifecycleConflictError();
      await scope.query(`UPDATE rental_operations.occupancies SET lifecycle_status='ENDED',ended_at=$3,updated_at=$3 WHERE tenant_id=$1::uuid AND occupancy_id=$2::uuid`, [input.tenantId, input.occupancyId, input.checkedOutAt]);
      await scope.query(`UPDATE rental_operations.stays SET lifecycle_status='COMPLETED',actual_check_out_at=$3,updated_at=$3 WHERE tenant_id=$1::uuid AND stay_id=$2::uuid`, [input.tenantId, source.stay_id, input.checkedOutAt]);
      await scope.query(`UPDATE rental_operations.bookings SET lifecycle_status='COMPLETED',updated_at=$3 WHERE tenant_id=$1::uuid AND booking_id=$2::uuid`, [input.tenantId, source.booking_id, input.checkedOutAt]);
      const bookingAllocations = await scope.query<{ readonly allocation_id: string }>(`UPDATE rental_operations.rental_allocations SET status='RELEASED',updated_at=$3
        WHERE tenant_id=$1::uuid AND source_booking_id=$2::uuid AND status='ACTIVE' RETURNING allocation_id`, [input.tenantId, source.booking_id, input.checkedOutAt]);
      for (const allocation of bookingAllocations) {
        await scope.query(`UPDATE rental_operations.rental_allocation_claims SET status='RELEASED' WHERE tenant_id=$1::uuid AND allocation_id=$2::uuid`, [input.tenantId, allocation.allocation_id]);
        await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.allocation-released",
          aggregateId: allocation.allocation_id, correlationId: input.operationalBlockId, occurredAt: input.checkedOutAt,
          payload: { allocationId: allocation.allocation_id, bookingId: source.booking_id, rentableAssetId: source.rentable_asset_id } });
      }
      await scope.query(`INSERT INTO rental_operations.operational_blocks
        (operational_block_id,tenant_id,rentable_asset_id,reason,note,source_type,source_id,status,start_at,end_at,created_at,updated_at)
        VALUES ($1,$2,$3,'CLEANING','Turnover après départ','STAY',$4,'ACTIVE',$5,$6,$5,$5)`,
      [input.operationalBlockId, input.tenantId, source.rentable_asset_id, source.stay_id, input.checkedOutAt, input.expectedCleaningCompletionAt]);
      await scope.query(`INSERT INTO rental_operations.rental_allocations
        (allocation_id,tenant_id,rentable_asset_id,allocation_type,source_operational_block_id,start_at,end_at,status,created_at,updated_at)
        VALUES ($1,$2,$3,'OPERATIONAL_BLOCK',$4,$5,$6,'ACTIVE',$5,$5)`,
      [input.allocationId, input.tenantId, source.rentable_asset_id, input.operationalBlockId, input.checkedOutAt, input.expectedCleaningCompletionAt]);
      for (const conflictScopeId of [...new Set(input.conflictScopeIds)].sort()) {
        await scope.query(`INSERT INTO rental_operations.rental_allocation_claims (tenant_id,allocation_id,conflict_scope_id,start_at,end_at,status)
          VALUES ($1,$2,$3,$4,$5,'ACTIVE')`, [input.tenantId, input.allocationId, conflictScopeId, input.checkedOutAt, input.expectedCleaningCompletionAt]);
      }
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.occupancy-ended",
        aggregateId: input.occupancyId, correlationId: input.operationalBlockId, occurredAt: input.checkedOutAt,
        payload: { occupancyId: input.occupancyId, stayId: source.stay_id, rentableAssetId: source.rentable_asset_id, mode: "SHORT_TERM_RENTAL" } });
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.stay-completed",
        aggregateId: source.stay_id, correlationId: input.operationalBlockId, occurredAt: input.checkedOutAt,
        payload: { stayId: source.stay_id, bookingId: source.booking_id, occupancyId: input.occupancyId, rentableAssetId: source.rentable_asset_id } });
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.operational-block-created",
        aggregateId: input.operationalBlockId, correlationId: input.operationalBlockId, occurredAt: input.checkedOutAt,
        payload: { operationalBlockId: input.operationalBlockId, reason: "CLEANING", stayId: source.stay_id,
          rentableAssetId: source.rentable_asset_id, startsAt: input.checkedOutAt, endsAt: input.expectedCleaningCompletionAt } });
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.allocation-created",
        aggregateId: input.allocationId, correlationId: input.operationalBlockId, occurredAt: input.checkedOutAt,
        payload: { allocationId: input.allocationId, operationalBlockId: input.operationalBlockId, rentableAssetId: source.rentable_asset_id } });
      return toSnapshot((await findTurnover(scope, input.tenantId, source.stay_id))!);
    });
  }

  completeCleaning(input: Readonly<{ tenantId: string; actorId: string; operationalBlockId: string; completedAt: string }>): Promise<TurnoverSnapshot> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const row = (await scope.query<TurnoverRow>(`${turnoverSelect()} AND b.operational_block_id=$2::uuid FOR UPDATE OF b`, [input.tenantId, input.operationalBlockId]))[0];
      if (row === undefined) throw new OperationalSourceNotFoundError();
      if (row.status === "RELEASED") {
        if (row.completed_at?.toISOString() !== input.completedAt || row.completed_by_actor_id !== input.actorId) throw new OperationalLifecycleConflictError();
        return toSnapshot(row);
      }
      await scope.query(`UPDATE rental_operations.operational_blocks SET status='RELEASED',updated_at=$3,completed_at=$3,completed_by_actor_id=$4
        WHERE tenant_id=$1::uuid AND operational_block_id=$2::uuid`, [input.tenantId, input.operationalBlockId, input.completedAt, input.actorId]);
      const allocations = await scope.query<{ readonly allocation_id: string }>(`UPDATE rental_operations.rental_allocations SET status='RELEASED',updated_at=$3
        WHERE tenant_id=$1::uuid AND source_operational_block_id=$2::uuid AND status='ACTIVE' RETURNING allocation_id`, [input.tenantId, input.operationalBlockId, input.completedAt]);
      for (const allocation of allocations) {
        await scope.query(`UPDATE rental_operations.rental_allocation_claims SET status='RELEASED' WHERE tenant_id=$1::uuid AND allocation_id=$2::uuid`, [input.tenantId, allocation.allocation_id]);
        await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.allocation-released",
          aggregateId: allocation.allocation_id, correlationId: input.operationalBlockId, occurredAt: input.completedAt,
          payload: { allocationId: allocation.allocation_id, operationalBlockId: input.operationalBlockId, rentableAssetId: row.rentable_asset_id } });
      }
      await recordRentalOperationsEvent(scope, { tenantId: input.tenantId, eventType: "monpiole.rental-operations.operational-block-released",
        aggregateId: input.operationalBlockId, correlationId: input.operationalBlockId, occurredAt: input.completedAt,
        payload: { operationalBlockId: input.operationalBlockId, reason: "CLEANING", rentableAssetId: row.rentable_asset_id,
          completedByActorId: input.actorId } });
      return toSnapshot((await scope.query<TurnoverRow>(`${turnoverSelect()} AND b.operational_block_id=$2::uuid`, [input.tenantId, input.operationalBlockId]))[0]!);
    });
  }
}

function turnoverSelect(): string {
  return `SELECT b.operational_block_id,b.status,b.start_at,b.end_at,b.completed_at,b.completed_by_actor_id,b.source_id,
    o.occupancy_id,s.booking_id,b.rentable_asset_id FROM rental_operations.operational_blocks b
    JOIN rental_operations.stays s ON s.tenant_id=b.tenant_id AND s.stay_id=b.source_id
    JOIN rental_operations.occupancies o ON o.tenant_id=s.tenant_id AND o.source_stay_id=s.stay_id
    WHERE b.tenant_id=$1::uuid AND b.source_type='STAY' AND b.reason='CLEANING'`;
}

async function findTurnover(scope: PostgresTransactionScope, tenantId: string, stayId: string): Promise<TurnoverRow | undefined> {
  return (await scope.query<TurnoverRow>(`${turnoverSelect()} AND b.source_id=$2::uuid`, [tenantId, stayId]))[0];
}

function toSnapshot(row: TurnoverRow): TurnoverSnapshot {
  return { occupancyId: row.occupancy_id, stayId: row.source_id, bookingId: row.booking_id, rentableAssetId: row.rentable_asset_id,
    checkedOutAt: row.start_at.toISOString(), cleaningBlockId: row.operational_block_id,
    cleaningStartsAt: row.start_at.toISOString(), cleaningEndsAt: row.end_at.toISOString(), cleaningStatus: row.status,
    ...(row.completed_at === null ? {} : { cleaningCompletedAt: row.completed_at.toISOString(), cleaningCompletedByActorId: row.completed_by_actor_id! }) };
}
