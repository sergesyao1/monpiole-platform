import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq, sql } from "drizzle-orm";
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
      const [ownerRows, compositionRow, contractRow] = await Promise.all([
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
        }).from(propertyBuildings)
          .leftJoin(propertyBuildingUnits, and(
            eq(propertyBuildingUnits.tenantId, propertyBuildings.tenantId),
            eq(propertyBuildingUnits.buildingId, propertyBuildings.buildingId),
          ))
          .where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId))),
        scope.database().select({
          totalCount: sql<number>`count(*)::int`,
          draftCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'DRAFT')::int`,
          activeCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'ACTIVE')::int`,
          endedCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'ENDED')::int`,
          cancelledCount: sql<number>`count(*) filter (where ${propertyContracts.status} = 'CANCELLED')::int`,
        }).from(propertyContracts).where(and(
          eq(propertyContracts.tenantId, tenantId), eq(propertyContracts.propertyId, propertyId),
        )),
      ]);
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
        composition,
        contracts,
      };
    });
  }
}
