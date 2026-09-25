import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import {
  type PropertyGeolocationMutationTrace,
  type PropertyGeolocationRepository,
  type PropertyGeolocationResolution,
} from "../../../application/property-geolocation-repository.js";
import {
  PropertyGeolocation,
  type PropertyGeolocationPublicVisibility,
} from "../../../domain/property-geolocation.js";
import { PersistedPropertyCorruptionError } from "../../../domain/property.js";
import {
  properties,
  propertyBuildings,
  propertyBuildingUnits,
  propertyGeolocations,
} from "./schema.js";

export class PostgresPropertyGeolocationRepository implements PropertyGeolocationRepository {
  constructor(private readonly pool: Pool) {}

  findEffective(tenantId: string, propertyId: string): Promise<PropertyGeolocationResolution | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ structuralRole: properties.structuralRole })
        .from(properties)
        .where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)))
        .limit(1))[0];
      if (property === undefined) return undefined;
      const own = await findRow(scope.database(), tenantId, propertyId);
      if (own !== undefined) return { source: "OWN", geolocation: toGeolocation(own) };

      if (property.structuralRole !== "UNIT") {
        const parents = await scope.query<{ parent_id: string }>(`
          SELECT complex_property_id AS parent_id FROM property_management.property_complex_children
          WHERE tenant_id=$1::uuid AND child_property_id=$2::uuid
          UNION ALL
          SELECT property_id AS parent_id FROM property_management.property_buildings
          WHERE tenant_id=$1::uuid AND building_property_id=$2::uuid AND property_id<>building_property_id
        `, [tenantId, propertyId]);
        const parentId = parents[0]?.parent_id;
        if (parentId === undefined) return { source: "OWN" };
        const inherited = await findRow(scope.database(), tenantId, parentId);
        return inherited === undefined
          ? { source: "INHERITED", inheritedFromPropertyId: parentId }
          : { source: "INHERITED", inheritedFromPropertyId: parentId, geolocation: toGeolocation(inherited) };
      }

      const relation = (await scope.database().select({ buildingId: propertyBuildingUnits.buildingId })
        .from(propertyBuildingUnits)
        .where(and(
          eq(propertyBuildingUnits.tenantId, tenantId),
          eq(propertyBuildingUnits.unitPropertyId, propertyId),
        )).limit(2));
      if (relation.length !== 1) throw new PersistedPropertyCorruptionError("buildingUnit");
      const building = (await scope.database().select({ parentPropertyId: propertyBuildings.propertyId, buildingPropertyId: propertyBuildings.buildingPropertyId })
        .from(propertyBuildings)
        .where(and(
          eq(propertyBuildings.tenantId, tenantId),
          eq(propertyBuildings.buildingId, relation[0]!.buildingId),
        )).limit(1))[0];
      if (building === undefined) throw new PersistedPropertyCorruptionError("buildingUnit");
      const effectiveParentId = building.buildingPropertyId ?? building.parentPropertyId;
      const parent = (await scope.database().select({ structuralRole: properties.structuralRole })
        .from(properties)
        .where(and(
          eq(properties.tenantId, tenantId),
          eq(properties.propertyId, effectiveParentId),
        )).limit(1))[0];
      if (parent?.structuralRole !== "COMPOSITE") throw new PersistedPropertyCorruptionError("buildingUnit");
      const parentIds = effectiveParentId === building.parentPropertyId
        ? [effectiveParentId] : [effectiveParentId, building.parentPropertyId];
      for (const parentId of parentIds) {
        const row = await findRow(scope.database(), tenantId, parentId);
        if (row !== undefined) return { source: "INHERITED", inheritedFromPropertyId: parentId, geolocation: toGeolocation(row) };
      }
      return { source: "INHERITED", inheritedFromPropertyId: effectiveParentId };
    });
  }

  saveOwn(
    tenantId: string,
    propertyId: string,
    geolocation: PropertyGeolocation,
    trace: PropertyGeolocationMutationTrace,
  ): Promise<PropertyGeolocation | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ structuralRole: properties.structuralRole })
        .from(properties)
        .where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)))
        .limit(1)
        .for("update"))[0];
      if (property === undefined) return undefined;
      const currentRow = await findRow(scope.database(), tenantId, propertyId);
      if (currentRow !== undefined) {
        const current = toGeolocation(currentRow);
        if (current.samePositionAs(geolocation)) return current;
      }
      await scope.database().insert(propertyGeolocations).values({
        tenantId,
        propertyId,
        latitude: geolocation.values.latitude,
        longitude: geolocation.values.longitude,
        publicVisibility: geolocation.values.publicVisibility,
        updatedAt: trace.updatedAt,
        correlationId: trace.correlationId,
        actorId: trace.actorId,
      }).onConflictDoUpdate({
        target: [propertyGeolocations.tenantId, propertyGeolocations.propertyId],
        set: {
          latitude: geolocation.values.latitude,
          longitude: geolocation.values.longitude,
          publicVisibility: geolocation.values.publicVisibility,
          updatedAt: trace.updatedAt,
          correlationId: trace.correlationId,
          actorId: trace.actorId,
        },
      });
      return geolocation;
    });
  }

  removeOwn(tenantId: string, propertyId: string): Promise<boolean | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ structuralRole: properties.structuralRole })
        .from(properties)
        .where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)))
        .limit(1)
        .for("update"))[0];
      if (property === undefined) return undefined;
      const current = await findRow(scope.database(), tenantId, propertyId);
      if (current === undefined) return false;
      await scope.database().delete(propertyGeolocations).where(and(
        eq(propertyGeolocations.tenantId, tenantId),
        eq(propertyGeolocations.propertyId, propertyId),
      ));
      return true;
    });
  }
}

type PropertyGeolocationRow = typeof propertyGeolocations.$inferSelect;

async function findRow(
  database: NodePgDatabase,
  tenantId: string,
  propertyId: string,
): Promise<PropertyGeolocationRow | undefined> {
  return (await database.select().from(propertyGeolocations).where(and(
    eq(propertyGeolocations.tenantId, tenantId),
    eq(propertyGeolocations.propertyId, propertyId),
  )).limit(1))[0];
}

function toGeolocation(row: PropertyGeolocationRow): PropertyGeolocation {
  return PropertyGeolocation.rehydrate({
    propertyId: row.propertyId,
    tenantId: row.tenantId,
    latitude: row.latitude,
    longitude: row.longitude,
    publicVisibility: row.publicVisibility as PropertyGeolocationPublicVisibility,
  });
}
