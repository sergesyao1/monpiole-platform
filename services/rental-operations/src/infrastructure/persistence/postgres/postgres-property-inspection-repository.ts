import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type {
  CompletedPropertyInspection,
  InspectionConditionRecord,
  InspectionEvidenceReference,
  InspectionSource,
  PropertyInspectionRepository,
} from "../../../application/property-inspections.js";
import { OperationalLifecycleConflictError, OperationalSourceNotFoundError } from "../../../application/operational-lifecycle.js";
import type { PropertyInspectionType, RentalOperationMode } from "../../../domain/rental-operations.js";

interface InspectionRow extends Record<string, unknown> {
  readonly inspection_id: string;
  readonly tenant_id: string;
  readonly rentable_asset_id: string;
  readonly occupancy_id: string | null;
  readonly source_lease_id: string | null;
  readonly source_booking_id: string | null;
  readonly mode: RentalOperationMode;
  readonly inspection_type: PropertyInspectionType;
  readonly occurred_at: Date;
  readonly responsible_actor_id: string;
  readonly condition_records: readonly InspectionConditionRecord[];
  readonly evidence_references: readonly InspectionEvidenceReference[];
}

export class PostgresPropertyInspectionRepository implements PropertyInspectionRepository {
  constructor(private readonly pool: Pool) {}

  complete(input: Readonly<{ tenantId: string; actorId: string; inspectionId: string; idempotencyKey: string; mode: RentalOperationMode; type: PropertyInspectionType; source: InspectionSource; occurredAt: string; conditionRecords: readonly InspectionConditionRecord[]; evidenceReferences: readonly InspectionEvidenceReference[] }>): Promise<CompletedPropertyInspection> {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const sourceTable = input.source.type === "LEASE" ? "leases" : input.source.type === "BOOKING" ? "bookings" : "occupancies";
      const sourceColumn = input.source.type === "LEASE" ? "lease_id" : input.source.type === "BOOKING" ? "booking_id" : "occupancy_id";
      const sources = await scope.query<{ readonly rentable_asset_id: string; readonly mode: RentalOperationMode }>(
        `SELECT rentable_asset_id,mode FROM rental_operations.${sourceTable} WHERE tenant_id=$1::uuid AND ${sourceColumn}=$2::uuid FOR UPDATE`,
        [input.tenantId, input.source.id],
      );
      const source = sources[0];
      if (source === undefined) throw new OperationalSourceNotFoundError();
      if (source.mode !== input.mode) throw new OperationalLifecycleConflictError();
      const prior = (await scope.query<InspectionRow>(`SELECT * FROM rental_operations.property_inspections
        WHERE tenant_id=$1::uuid AND idempotency_key=$2::uuid`, [input.tenantId, input.idempotencyKey]))[0];
      if (prior !== undefined) {
        const result = toInspection(prior);
        if (JSON.stringify(result.conditionRecords) !== JSON.stringify(input.conditionRecords)
          || JSON.stringify(result.evidenceReferences) !== JSON.stringify(input.evidenceReferences)
          || result.type !== input.type || result.source.type !== input.source.type || result.source.id !== input.source.id) {
          throw new OperationalLifecycleConflictError();
        }
        return result;
      }
      const leaseId = input.source.type === "LEASE" ? input.source.id : null;
      const bookingId = input.source.type === "BOOKING" ? input.source.id : null;
      const occupancyId = input.source.type === "OCCUPANCY" ? input.source.id : null;
      const rows = await scope.query<InspectionRow>(`INSERT INTO rental_operations.property_inspections
        (inspection_id,tenant_id,rentable_asset_id,occupancy_id,source_lease_id,source_booking_id,mode,inspection_type,
         occurred_at,lifecycle_status,responsible_actor_id,idempotency_key,condition_records,evidence_references,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'COMPLETED',$10,$11,$12::jsonb,$13::jsonb,$9,$9) RETURNING *`,
      [input.inspectionId, input.tenantId, source.rentable_asset_id, occupancyId, leaseId, bookingId, input.mode, input.type,
        input.occurredAt, input.actorId, input.idempotencyKey, JSON.stringify(input.conditionRecords), JSON.stringify(input.evidenceReferences)]);
      return toInspection(rows[0]!);
    });
  }

  findEntryForExit(tenantId: string, occupancyId: string): Promise<CompletedPropertyInspection | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<InspectionRow>(`SELECT i.* FROM rental_operations.occupancies o
        LEFT JOIN rental_operations.stays s ON s.tenant_id=o.tenant_id AND s.stay_id=o.source_stay_id
        JOIN rental_operations.property_inspections i ON i.tenant_id=o.tenant_id AND i.inspection_type='ENTRY'
          AND (i.source_lease_id=o.source_lease_id OR i.source_booking_id=s.booking_id)
        WHERE o.tenant_id=$1::uuid AND o.occupancy_id=$2::uuid`, [tenantId, occupancyId]);
      return rows[0] === undefined ? undefined : toInspection(rows[0]);
    });
  }
}

function toInspection(row: InspectionRow): CompletedPropertyInspection {
  const source: InspectionSource = row.source_lease_id !== null ? { type: "LEASE", id: row.source_lease_id }
    : row.source_booking_id !== null ? { type: "BOOKING", id: row.source_booking_id }
      : { type: "OCCUPANCY", id: row.occupancy_id! };
  return { inspectionId: row.inspection_id, tenantId: row.tenant_id, rentableAssetId: row.rentable_asset_id,
    mode: row.mode, type: row.inspection_type, source, occurredAt: row.occurred_at.toISOString(),
    responsibleActorId: row.responsible_actor_id, status: "COMPLETED",
    conditionRecords: row.condition_records, evidenceReferences: row.evidence_references };
}
