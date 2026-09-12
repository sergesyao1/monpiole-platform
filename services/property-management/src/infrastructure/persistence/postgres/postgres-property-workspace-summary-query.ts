import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq, or, sql } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyWorkspaceSummary,
  PropertyWorkspaceSummaryQuery,
} from "../../../application/property-workspace-summary-query.js";
import {
  properties,
  propertyBuildings,
  propertyBuildingUnits,
  propertyContracts,
  propertyOwners,
  propertyOwnerships,
} from "./schema.js";

export class PostgresPropertyWorkspaceSummaryQuery implements PropertyWorkspaceSummaryQuery {
  constructor(private readonly pool: Pool) {}

  retrieve(tenantId: string, propertyId: string): Promise<PropertyWorkspaceSummary | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const exists = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1))[0];
      if (exists === undefined) return undefined;
      const [ownerRows, compositionRow, contractRow, parentRows] = await Promise.all([
        scope.database().select({ ownership: propertyOwnerships, owner: propertyOwners })
          .from(propertyOwnerships)
          .innerJoin(propertyOwners, and(
            eq(propertyOwners.tenantId, propertyOwnerships.tenantId),
            eq(propertyOwners.ownerId, propertyOwnerships.ownerId),
          ))
          .where(and(eq(propertyOwnerships.tenantId, tenantId), eq(propertyOwnerships.propertyId, propertyId)))
          .orderBy(propertyOwners.ownerId),
        scope.database().select({
          buildingCount: sql<number>`count(distinct ${propertyBuildings.buildingId})::int`,
          unitCount: sql<number>`count(distinct ${propertyBuildingUnits.unitPropertyId})::int`,
          directChildCount: sql<number>`(SELECT count(*)::int FROM property_management.property_complex_children child WHERE child.tenant_id = ${tenantId}::uuid AND child.complex_property_id = ${propertyId}::uuid)`,
        }).from(propertyBuildings)
          .leftJoin(propertyBuildingUnits, and(
            eq(propertyBuildingUnits.tenantId, propertyBuildings.tenantId),
            eq(propertyBuildingUnits.buildingId, propertyBuildings.buildingId),
          ))
          .where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)))),
        scope.database().select({
          totalCount: sql<number>`count(*)::int`,
          draftCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'DRAFT')::int`,
          activeCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'ACTIVE')::int`,
          endedCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'ENDED')::int`,
          cancelledCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'CANCELLED')::int`,
        }).from(propertyContracts).where(and(
          eq(propertyContracts.tenantId, tenantId), eq(propertyContracts.propertyId, propertyId),
        )),
        scope.database().select({
          buildingId: propertyBuildings.buildingId,
          buildingCode: propertyBuildings.buildingCode,
          buildingName: propertyBuildings.name,
          parentPropertyId: properties.propertyId,
          parentPropertyTitle: properties.title,
          parentBuildingCommercializationMode: properties.commercializationMode,
        }).from(propertyBuildingUnits)
          .innerJoin(propertyBuildings, and(
            eq(propertyBuildings.tenantId, propertyBuildingUnits.tenantId),
            eq(propertyBuildings.buildingId, propertyBuildingUnits.buildingId),
          ))
          .innerJoin(properties, and(
            eq(properties.tenantId, propertyBuildings.tenantId),
            sql`${properties.propertyId} = coalesce(${propertyBuildings.buildingPropertyId}, ${propertyBuildings.propertyId})`,
          ))
          .where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.unitPropertyId, propertyId)))
          .limit(1),
      ]);
      const parentComplexRows = await scope.query<{ property_id: string; title: string }>(`
        SELECT parent.property_id, parent.title FROM property_management.properties parent
        JOIN property_management.property_complex_children child
          ON child.tenant_id=parent.tenant_id AND child.complex_property_id=parent.property_id
        WHERE child.tenant_id=$1::uuid AND child.child_property_id=$2::uuid
        UNION ALL
        SELECT parent.property_id, parent.title FROM property_management.properties parent
        JOIN property_management.property_buildings building
          ON building.tenant_id=parent.tenant_id AND building.property_id=parent.property_id
        WHERE building.tenant_id=$1::uuid AND building.building_property_id=$2::uuid
          AND building.property_id<>building.building_property_id
      `, [tenantId, propertyId]);
      const composition = compositionRow[0];
      const contracts = contractRow[0];
      if (composition === undefined || contracts === undefined) throw new Error("Property workspace aggregation failed");
      return {
        owners: ownerRows.map(({ owner, ownership }) => ({
          ownerId: owner.ownerId,
          displayName: owner.ownerType === "INDIVIDUAL"
            ? `${owner.firstName!} ${owner.lastName!}`
            : owner.legalName!,
          ownershipShare: ownership.ownershipShare,
        })),
        composition: { ...composition,
          ...(parentRows[0] === undefined ? {} : { parentBuilding: {
            buildingId: parentRows[0].buildingId, buildingCode: parentRows[0].buildingCode,
            buildingName: parentRows[0].buildingName, parentPropertyId: parentRows[0].parentPropertyId,
            parentPropertyTitle: parentRows[0].parentPropertyTitle,
            ...(parentRows[0].parentBuildingCommercializationMode === null ? {} : {
              parentBuildingCommercializationMode: parentRows[0].parentBuildingCommercializationMode as "WHOLE_BUILDING" | "INDIVIDUAL_UNITS",
            }),
          } }),
          ...(parentComplexRows[0] === undefined ? {} : { parentComplex: { propertyId: parentComplexRows[0].property_id, title: parentComplexRows[0].title } }),
        },
        contracts,
      };
    });
  }
}
