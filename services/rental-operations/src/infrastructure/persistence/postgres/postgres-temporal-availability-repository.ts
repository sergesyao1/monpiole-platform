import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type {
  AvailabilityConflict,
  AvailabilityQueryPort,
  RentalAllocationCommitPort,
} from "../../../application/temporal-availability.js";
import type { RentalAllocation } from "../../../domain/rental-operations.js";

interface ConflictRow extends Record<string, unknown> {
  readonly allocation_id: string;
  readonly allocation_type: "LEASE" | "BOOKING" | "OPERATIONAL_BLOCK";
  readonly start_at: Date;
  readonly end_at: Date | null;
}

export class PostgresTemporalAvailabilityRepository
implements AvailabilityQueryPort, RentalAllocationCommitPort {
  constructor(private readonly pool: Pool) {}

  listActiveConflicts(input: Readonly<{
    tenantId: string;
    conflictScopeIds: readonly string[];
    startsAt: string;
    endsAt?: string;
  }>): Promise<readonly AvailabilityConflict[]> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const rows = await scope.query<ConflictRow>(`
        SELECT DISTINCT a.allocation_id, a.allocation_type, a.start_at, a.end_at
        FROM rental_operations.rental_allocation_claims AS claim
        INNER JOIN rental_operations.rental_allocations AS a
          ON a.tenant_id = claim.tenant_id AND a.allocation_id = claim.allocation_id
        WHERE claim.tenant_id = $1::uuid
          AND claim.conflict_scope_id = ANY($2::uuid[])
          AND claim.status = 'ACTIVE'
          AND (claim.end_at IS NULL OR claim.end_at > $3::timestamptz)
          AND ($4::timestamptz IS NULL OR claim.start_at < $4::timestamptz)
        ORDER BY a.start_at, a.allocation_id
      `, [input.tenantId, input.conflictScopeIds, input.startsAt, input.endsAt ?? null]);
      return rows.map(toConflict);
    });
  }

  hasEffectiveLongTermOccupancy(input: Readonly<{
    tenantId: string;
    conflictScopeIds: readonly string[];
    at: string;
  }>): Promise<boolean> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const rows = await scope.query<{ readonly present: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM rental_operations.rental_allocation_claims AS claim
          INNER JOIN rental_operations.rental_allocations AS a
            ON a.tenant_id = claim.tenant_id AND a.allocation_id = claim.allocation_id
          WHERE claim.tenant_id = $1::uuid
            AND claim.conflict_scope_id = ANY($2::uuid[])
            AND claim.status = 'ACTIVE'
            AND a.rental_mode = 'LONG_TERM_RENTAL'
            AND claim.start_at <= $3::timestamptz
            AND (claim.end_at IS NULL OR claim.end_at > $3::timestamptz)
        ) AS present
      `, [input.tenantId, input.conflictScopeIds, input.at]);
      return rows[0]?.present ?? false;
    });
  }

  commitIfAvailable(allocation: RentalAllocation, conflictScopeIds: readonly string[]): Promise<void> {
    const value = allocation.values;
    const scopes = [...new Set(conflictScopeIds)].sort();
    if (scopes.length === 0) throw new Error("At least one conflict scope is required");
    return withTenantPostgresTransaction(this.pool, value.tenantId, async (scope) => {
      await scope.query(`
        INSERT INTO rental_operations.rental_allocations (
          allocation_id, tenant_id, rentable_asset_id, allocation_type, rental_mode,
          source_lease_id, source_booking_id, source_operational_block_id,
          start_at, end_at, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        value.allocationId, value.tenantId, value.rentableAssetId,
        value.allocationType, value.rentalMode ?? null,
        value.allocationType === "LEASE" ? value.sourceLeaseId : null,
        value.allocationType === "BOOKING" ? value.sourceBookingId : null,
        value.allocationType === "OPERATIONAL_BLOCK" ? value.sourceOperationalBlockId : null,
        value.startAt, value.endAt ?? null, value.status, value.createdAt, value.updatedAt,
      ]);
      for (const conflictScopeId of scopes) {
        await scope.query(`
          INSERT INTO rental_operations.rental_allocation_claims (
            tenant_id, allocation_id, conflict_scope_id, start_at, end_at, status
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [value.tenantId, value.allocationId, conflictScopeId, value.startAt, value.endAt ?? null, value.status]);
      }
    });
  }

  release(tenantId: string, allocationId: string, updatedAt: string): Promise<boolean> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<{ readonly allocation_id: string }>(`
        UPDATE rental_operations.rental_allocations
        SET status = 'RELEASED', updated_at = $3::timestamptz
        WHERE tenant_id = $1::uuid AND allocation_id = $2::uuid AND status = 'ACTIVE'
        RETURNING allocation_id
      `, [tenantId, allocationId, updatedAt]);
      if (rows.length === 0) return false;
      await scope.query(`
        UPDATE rental_operations.rental_allocation_claims
        SET status = 'RELEASED'
        WHERE tenant_id = $1::uuid AND allocation_id = $2::uuid
      `, [tenantId, allocationId]);
      return true;
    });
  }
}

function toConflict(row: ConflictRow): AvailabilityConflict {
  return {
    conflictId: row.allocation_id,
    kind: row.allocation_type === "OPERATIONAL_BLOCK" ? "OPERATIONAL_BLOCK" : "ALLOCATION",
    startsAt: row.start_at.toISOString(),
    ...(row.end_at === null ? {} : { endsAt: row.end_at.toISOString() }),
  };
}
