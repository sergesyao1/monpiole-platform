import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, eq, gt, or } from "drizzle-orm";
import type { Pool } from "pg";

import type { CompositionCursor, CompositionPage, PropertyCompositionRepository, PropertyUnitView, Trace } from "../../../application/property-composition-repository.js";
import { PropertyBuildingCodeConflictError, PropertyUnitCodeConflictError } from "../../../application/property-composition-repository.js";
import type { Property } from "../../../domain/property.js";
import { InvalidPropertyCompositionServerValueError, PropertyBuilding } from "../../../domain/property-building.js";
import { PropertyBuildingUnit } from "../../../domain/property-building-unit.js";
import { properties, propertyBuildings, propertyBuildingUnits } from "./schema.js";
import { toProperty } from "./postgres-property-repository.js";

export class PostgresPropertyCompositionRepository implements PropertyCompositionRepository {
  constructor(private readonly pool: Pool) {}

  createBuilding(tenantId: string, propertyId: string, building: PropertyBuilding, trace: Trace): Promise<PropertyBuilding | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const locked = (await scope.database().select().from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0];
      if (locked === undefined) return undefined;
      const lockedParent = toProperty(locked).becomeComposite(building.values.updatedAt);
      if (lockedParent.values.structuralRole !== locked.structuralRole) await scope.database().update(properties).set({ structuralRole: "COMPOSITE", updatedAt: building.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId }).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)));
      await scope.database().insert(propertyBuildings).values({ ...building.values, correlationId: trace.correlationId, actorId: trace.actorId });
      return building;
    }), "building");
  }

  listBuildings(tenantId: string, propertyId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<Readonly<PropertyBuilding["values"]>> | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).limit(1))[0];
      if (parent === undefined) return undefined;
      const cursorFilter = cursor === undefined ? undefined : or(gt(propertyBuildings.buildingCode, cursor.code), and(eq(propertyBuildings.buildingCode, cursor.code), gt(propertyBuildings.buildingId, cursor.id)));
      const rows = await scope.database().select().from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId), cursorFilter)).orderBy(asc(propertyBuildings.buildingCode), asc(propertyBuildings.buildingId)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => PropertyBuilding.rehydrate(toBuildingValues(row)).values); const last = rows.length > limit ? items.at(-1) : undefined;
      return { items, ...(last === undefined ? {} : { nextCursor: { code: last.buildingCode, id: last.buildingId } }) };
    });
  }

  updateBuilding(tenantId: string, propertyId: string, buildingId: string, update: (building: PropertyBuilding) => PropertyBuilding, trace: Trace): Promise<PropertyBuilding | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0];
      if (parent === undefined) return undefined;
      const row = (await scope.database().select().from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0];
      if (row === undefined) return undefined; const building = update(PropertyBuilding.rehydrate(toBuildingValues(row)));
      await scope.database().update(propertyBuildings).set({ buildingCode: building.values.buildingCode, name: building.values.name, updatedAt: building.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId }).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.buildingId, buildingId)));
      return building;
    }), "building");
  }

  async createUnit(tenantId: string, propertyId: string, relation: PropertyBuildingUnit, unit: Property, trace: Trace): Promise<PropertyUnitView | undefined> {
    if (relation.values.tenantId !== tenantId || unit.values.tenantId !== tenantId) {
      throw new InvalidPropertyCompositionServerValueError("tenantId");
    }
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ structuralRole: properties.structuralRole }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0];
      if (parent?.structuralRole !== "COMPOSITE") return undefined;
      const { buildingId, unitCode } = relation.values;
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0];
      if (building === undefined) return undefined; const value = unit.values;
      await scope.database().insert(properties).values({ propertyId: value.propertyId, tenantId, title: value.title, description: value.description, propertyType: value.propertyType, transactionType: value.transactionType, status: value.status, structuralRole: "UNIT", country: value.location.country, city: value.location.city, district: value.location.district, addressLine: value.location.addressLine, createdAt: value.createdAt, updatedAt: value.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId });
      await scope.database().insert(propertyBuildingUnits).values({ ...relation.values, correlationId: trace.correlationId, actorId: trace.actorId });
      return { unitCode, property: value };
    }), "unit");
  }

  listUnits(tenantId: string, propertyId: string, buildingId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<PropertyUnitView> | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingId, buildingId))).limit(1))[0];
      if (building === undefined) return undefined;
      const cursorFilter = cursor === undefined ? undefined : or(gt(propertyBuildingUnits.unitCode, cursor.code), and(eq(propertyBuildingUnits.unitCode, cursor.code), gt(propertyBuildingUnits.unitPropertyId, cursor.id)));
      const rows = await scope.database().select({ relation: propertyBuildingUnits, property: properties }).from(propertyBuildingUnits).innerJoin(properties, and(eq(properties.tenantId, propertyBuildingUnits.tenantId), eq(properties.propertyId, propertyBuildingUnits.unitPropertyId))).where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.buildingId, buildingId), cursorFilter)).orderBy(asc(propertyBuildingUnits.unitCode), asc(propertyBuildingUnits.unitPropertyId)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => {
        const property = toProperty(row.property);
        const relation = PropertyBuildingUnit.rehydrate(toUnitValues(row.relation), property);
        return { unitCode: relation.values.unitCode, property: property.values };
      }); const last = rows.length > limit ? items.at(-1) : undefined;
      return { items, ...(last === undefined ? {} : { nextCursor: { code: last.unitCode, id: last.property.propertyId } }) };
    });
  }

  updateUnitCode(tenantId: string, propertyId: string, buildingId: string, unitPropertyId: string, unitCode: string, updatedAt: string, trace: Trace): Promise<PropertyUnitView | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0]; if (parent === undefined) return undefined;
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0]; if (building === undefined) return undefined;
      const property = (await scope.database().select().from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, unitPropertyId))).limit(1))[0]; if (property === undefined) return undefined;
      const unit = toProperty(property);
      const relationRow = (await scope.database().select().from(propertyBuildingUnits).where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.buildingId, buildingId), eq(propertyBuildingUnits.unitPropertyId, unitPropertyId))).for("update").limit(1))[0]; if (relationRow === undefined) return undefined;
      const relation = PropertyBuildingUnit.rehydrate(toUnitValues(relationRow), unit).updateCode(unitCode, updatedAt);
      await scope.database().update(propertyBuildingUnits).set({ unitCode: relation.values.unitCode, updatedAt: relation.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId }).where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.buildingId, buildingId), eq(propertyBuildingUnits.unitPropertyId, unitPropertyId)));
      return { unitCode: relation.values.unitCode, property: unit.values };
    }), "unit");
  }

  private async conflicts<T>(operation: () => Promise<T>, kind: "building" | "unit"): Promise<T> {
    try { return await operation(); } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (kind === "building" && constraint === "property_buildings_tenant_property_code_unique") {
        throw new PropertyBuildingCodeConflictError();
      }
      if (kind === "unit" && constraint === "property_building_units_tenant_building_code_unique") {
        throw new PropertyUnitCodeConflictError();
      }
      throw error;
    }
  }
}
type BuildingRow = typeof propertyBuildings.$inferSelect;
function toBuildingValues(row: BuildingRow) { return { buildingId: row.buildingId, tenantId: row.tenantId, propertyId: row.propertyId, buildingCode: row.buildingCode, name: row.name, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() }; }
type BuildingUnitRow = typeof propertyBuildingUnits.$inferSelect;
function toUnitValues(row: BuildingUnitRow) { return { tenantId: row.tenantId, buildingId: row.buildingId, unitPropertyId: row.unitPropertyId, unitCode: row.unitCode, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() }; }
function uniqueViolationConstraint(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current !== null && typeof current === "object"; depth += 1) {
    if ("code" in current && current.code === "23505") {
      return "constraint" in current && typeof current.constraint === "string" ? current.constraint : undefined;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
