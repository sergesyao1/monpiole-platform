import type { PostgresTransactionScope } from "@monpiole/persistence";
import {
  assessPropertyLeaseEligibility,
  type PropertyContractPropertyContext,
  type PropertyLeaseEligibility,
} from "../../../domain/property-contract.js";

export interface PersistedLeaseTarget {
  readonly context: PropertyContractPropertyContext;
  readonly eligibility: PropertyLeaseEligibility;
  readonly rootPropertyId: string;
}

export async function loadPersistedLeaseTarget(
  scope: PostgresTransactionScope, tenantId: string, propertyId: string,
): Promise<PersistedLeaseTarget | undefined> {
  const rows = await scope.query<{
    structural_role: string; transaction_type: string; commercial_kind: string | null; building_count: number;
    root_property_id: string | null; unit_attached: boolean;
  }>(`
    SELECT p.structural_role, p.transaction_type, p.commercial_kind,
      (SELECT count(*)::int FROM property_management.property_buildings b
        WHERE b.tenant_id = p.tenant_id AND b.property_id = p.property_id) AS building_count,
      parent.property_id AS root_property_id,
      (bu.unit_property_id IS NOT NULL) AS unit_attached
    FROM property_management.properties p
    LEFT JOIN property_management.property_building_units bu
      ON bu.tenant_id = p.tenant_id AND bu.unit_property_id = p.property_id
    LEFT JOIN property_management.property_buildings parent
      ON parent.tenant_id = bu.tenant_id AND parent.building_id = bu.building_id
    WHERE p.tenant_id = $1::uuid AND p.property_id = $2::uuid
  `, [tenantId, propertyId]);
  const row = rows[0];
  if (row === undefined) return undefined;
  const context = {
    structuralRole: row.structural_role as PropertyContractPropertyContext["structuralRole"],
    transactionType: row.transaction_type as PropertyContractPropertyContext["transactionType"],
    buildingCount: row.building_count,
    wholeBuildingRentalConfigured: row.commercial_kind === "LONG_TERM_RENTAL",
    unitAttached: row.unit_attached,
  };
  return {
    context,
    eligibility: assessPropertyLeaseEligibility(context),
    rootPropertyId: row.root_property_id ?? propertyId,
  };
}

export async function hasActiveRelatedLease(
  scope: PostgresTransactionScope, tenantId: string, propertyId: string,
  target: PersistedLeaseTarget, excludeContractId?: string,
): Promise<boolean> {
  const related = target.context.structuralRole === "COMPOSITE"
    ? await scope.query<{ unit_property_id: string }>(`
      SELECT bu.unit_property_id FROM property_management.property_building_units bu
      JOIN property_management.property_buildings b
        ON b.tenant_id=bu.tenant_id AND b.building_id=bu.building_id
      WHERE b.tenant_id=$1::uuid AND b.property_id=$2::uuid
    `, [tenantId, propertyId]) : [];
  const targetIds = target.context.structuralRole === "COMPOSITE"
    ? [propertyId, ...related.map((unit) => unit.unit_property_id)]
    : target.context.structuralRole === "UNIT" ? [propertyId, target.rootPropertyId] : [propertyId];
  const rows = await scope.query<{ contract_id: string }>(`
    SELECT contract_id FROM property_management.property_contracts
    WHERE tenant_id=$1::uuid AND property_id=ANY($2::uuid[])
      AND contract_type='LEASE' AND status='ACTIVE'
      AND ($3::uuid IS NULL OR contract_id<>$3::uuid)
    LIMIT 1
  `, [tenantId, targetIds, excludeContractId ?? null]);
  return rows.length > 0;
}
