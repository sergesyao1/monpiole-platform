import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type {
  PropertyAvailabilityQuery,
  PropertyAvailabilityReadModel,
} from "../../../application/property-availability-query.js";
import type {
  PropertyAvailabilityStatus,
  PropertyOccupancyStatus,
} from "../../../domain/property.js";

interface AvailabilityRow extends Record<string, unknown> {
  readonly property_id: string;
  readonly structural_role: "STANDALONE" | "COMPOSITE" | "UNIT";
  readonly availability_status: PropertyAvailabilityStatus | null;
  readonly occupancy_status: PropertyOccupancyStatus | null;
  readonly availability_updated_at: Date | null;
  readonly total_unit_count: number;
  readonly configured_unit_count: number;
  readonly available_unit_count: number;
  readonly unavailable_unit_count: number;
  readonly vacant_unit_count: number;
  readonly occupied_unit_count: number;
}

export class PostgresPropertyAvailabilityQuery implements PropertyAvailabilityQuery {
  constructor(private readonly pool: Pool) {}

  retrieve(tenantId: string, propertyId: string): Promise<PropertyAvailabilityReadModel | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.query<AvailabilityRow>(`
        SELECT
          p.property_id,
          p.structural_role,
          p.availability_status,
          p.occupancy_status,
          p.availability_updated_at,
          COUNT(bu.unit_property_id)::integer AS total_unit_count,
          COUNT(bu.unit_property_id) FILTER (WHERE unit.availability_status IS NOT NULL)::integer AS configured_unit_count,
          COUNT(bu.unit_property_id) FILTER (WHERE unit.availability_status = 'AVAILABLE')::integer AS available_unit_count,
          COUNT(bu.unit_property_id) FILTER (WHERE unit.availability_status = 'UNAVAILABLE')::integer AS unavailable_unit_count,
          COUNT(bu.unit_property_id) FILTER (WHERE unit.occupancy_status = 'VACANT')::integer AS vacant_unit_count,
          COUNT(bu.unit_property_id) FILTER (WHERE unit.occupancy_status = 'OCCUPIED')::integer AS occupied_unit_count
        FROM property_management.properties AS p
        LEFT JOIN property_management.property_buildings AS building
          ON building.tenant_id = p.tenant_id AND building.property_id = p.property_id
        LEFT JOIN property_management.property_building_units AS bu
          ON bu.tenant_id = building.tenant_id AND bu.building_id = building.building_id
        LEFT JOIN property_management.properties AS unit
          ON unit.tenant_id = bu.tenant_id AND unit.property_id = bu.unit_property_id
        WHERE p.tenant_id = $1::uuid AND p.property_id = $2::uuid
        GROUP BY p.property_id, p.structural_role, p.availability_status, p.occupancy_status, p.availability_updated_at
      `, [tenantId, propertyId]))[0];
      if (row === undefined) return undefined;
      if (row.structural_role !== "COMPOSITE") {
        if (row.availability_status === null || row.occupancy_status === null || row.availability_updated_at === null) {
          return {
            propertyId: row.property_id,
            source: "DIRECT",
            structuralRole: row.structural_role,
            configured: false,
          };
        }
        return {
          propertyId: row.property_id,
          source: "DIRECT",
          structuralRole: row.structural_role,
          configured: true,
          availabilityStatus: row.availability_status,
          occupancyStatus: row.occupancy_status,
          updatedAt: row.availability_updated_at.toISOString(),
        };
      }
      const unconfiguredUnitCount = row.total_unit_count - row.configured_unit_count;
      const availabilityStatus = row.available_unit_count > 0
        ? "AVAILABLE"
        : row.total_unit_count > 0 && row.configured_unit_count === row.total_unit_count
          ? "UNAVAILABLE"
          : "NOT_CONFIGURED";
      return {
        propertyId: row.property_id,
        source: "DERIVED_FROM_UNITS",
        structuralRole: "COMPOSITE",
        availabilityStatus,
        totalUnitCount: row.total_unit_count,
        configuredUnitCount: row.configured_unit_count,
        availableUnitCount: row.available_unit_count,
        unavailableUnitCount: row.unavailable_unit_count,
        vacantUnitCount: row.vacant_unit_count,
        occupiedUnitCount: row.occupied_unit_count,
        unconfiguredUnitCount,
      };
    });
  }
}
