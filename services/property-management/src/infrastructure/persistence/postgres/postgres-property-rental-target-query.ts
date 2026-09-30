import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type {
  PropertyRentalTarget,
  PropertyRentalTargetQuery,
} from "../../../application/property-rental-target-query.js";

interface TargetRow extends Record<string, unknown> {
  readonly property_id: string;
  readonly transaction_type: "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL" | "SALE";
  readonly structural_role: "STANDALONE" | "COMPOSITE" | "UNIT";
  readonly commercialization_mode: "WHOLE_BUILDING" | "INDIVIDUAL_UNITS" | null;
}

interface UnitRow extends Record<string, unknown> {
  readonly building_property_id: string;
  readonly unit_property_id: string;
}

export class PostgresPropertyRentalTargetQuery implements PropertyRentalTargetQuery {
  constructor(private readonly pool: Pool) {}

  resolveMany(tenantId: string, propertyIds: readonly string[]): Promise<readonly PropertyRentalTarget[]> {
    const ids = [...new Set(propertyIds)];
    if (ids.length === 0) return Promise.resolve([]);
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const targets = await scope.query<TargetRow>(`
        SELECT property_id, transaction_type, structural_role, commercialization_mode
        FROM property_management.properties
        WHERE tenant_id = $1::uuid AND property_id = ANY($2::uuid[])
      `, [tenantId, ids]);
      const buildingIds = targets
        .filter((target) => target.structural_role === "COMPOSITE" && target.commercialization_mode === "WHOLE_BUILDING")
        .map((target) => target.property_id);
      const units = buildingIds.length === 0 ? [] : await scope.query<UnitRow>(`
        SELECT coalesce(b.building_property_id, b.property_id) AS building_property_id, bu.unit_property_id
        FROM property_management.property_buildings AS b
        INNER JOIN property_management.property_building_units AS bu
          ON bu.tenant_id = b.tenant_id AND bu.building_id = b.building_id
        WHERE b.tenant_id = $1::uuid
          AND coalesce(b.building_property_id, b.property_id) = ANY($2::uuid[])
      `, [tenantId, buildingIds]);
      return targets.flatMap((target): readonly PropertyRentalTarget[] => {
        if (target.transaction_type === "SALE") return [];
        if (target.structural_role === "COMPOSITE" && target.commercialization_mode !== "WHOLE_BUILDING") return [];
        const childIds = units
          .filter((unit) => unit.building_property_id === target.property_id)
          .map((unit) => unit.unit_property_id);
        return [{
          propertyId: target.property_id,
          rentalMode: target.transaction_type,
          structuralRole: target.structural_role,
          ...(target.commercialization_mode === null ? {} : { commercializationMode: target.commercialization_mode }),
          conflictScopeIds: target.structural_role === "COMPOSITE"
            ? [target.property_id, ...childIds]
            : [target.property_id],
        }];
      });
    });
  }
}
