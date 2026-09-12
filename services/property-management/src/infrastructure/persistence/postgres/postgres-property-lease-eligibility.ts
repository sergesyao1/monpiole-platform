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
    property_type: string; commercialization_mode: string | null; parent_building_commercialization_mode: string | null;
    root_property_id: string | null; unit_attached: boolean;
  }>(`
    SELECT p.structural_role, p.transaction_type, p.commercial_kind, p.property_type, p.commercialization_mode,
      building_property.commercialization_mode AS parent_building_commercialization_mode,
      (SELECT count(*)::int FROM property_management.property_buildings b
        WHERE b.tenant_id = p.tenant_id AND (b.property_id = p.property_id OR b.building_property_id = p.property_id)) AS building_count,
      coalesce(parent.building_property_id, parent.property_id) AS root_property_id,
      (bu.unit_property_id IS NOT NULL) AS unit_attached
    FROM property_management.properties p
    LEFT JOIN property_management.property_building_units bu
      ON bu.tenant_id = p.tenant_id AND bu.unit_property_id = p.property_id
    LEFT JOIN property_management.property_buildings parent
      ON parent.tenant_id = bu.tenant_id AND parent.building_id = bu.building_id
    LEFT JOIN property_management.properties building_property
      ON building_property.tenant_id = parent.tenant_id AND building_property.property_id = parent.building_property_id
    WHERE p.tenant_id = $1::uuid AND p.property_id = $2::uuid
  `, [tenantId, propertyId]);
  const row = rows[0];
  if (row === undefined) return undefined;
  const context = {
    structuralRole: row.structural_role as PropertyContractPropertyContext["structuralRole"],
    propertyType: row.property_type as PropertyContractPropertyContext["propertyType"],
    ...(row.commercialization_mode === null ? {} : { commercializationMode: row.commercialization_mode as PropertyContractPropertyContext["commercializationMode"] }),
    ...(row.parent_building_commercialization_mode === null ? {} : { parentBuildingCommercializationMode: row.parent_building_commercialization_mode as PropertyContractPropertyContext["parentBuildingCommercializationMode"] }),
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
      WHERE b.tenant_id=$1::uuid AND (b.property_id=$2::uuid OR b.building_property_id=$2::uuid)
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
