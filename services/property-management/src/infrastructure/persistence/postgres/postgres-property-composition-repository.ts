import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, eq, gt, or } from "drizzle-orm";
import type { Pool } from "pg";

import type { CompositionCursor, CompositionPage, PropertyComplexChildView, PropertyCompositionRepository, PropertyUnitView, Trace } from "../../../application/property-composition-repository.js";
import { PropertyBuildingCodeConflictError, PropertyComplexChildCodeConflictError, PropertyUnitCodeConflictError } from "../../../application/property-composition-repository.js";
import { PropertyStructuralRoleConflictError, type Property } from "../../../domain/property.js";
import { InvalidPropertyCompositionServerValueError, PropertyBuilding } from "../../../domain/property-building.js";
import { PropertyBuildingUnit } from "../../../domain/property-building-unit.js";
import { properties, propertyBuildings, propertyBuildingUnits, propertyComplexChildren } from "./schema.js";
import { toProperty } from "./postgres-property-repository.js";

export class PostgresPropertyCompositionRepository implements PropertyCompositionRepository {
  constructor(private readonly pool: Pool) {}

  createComplexChild(tenantId: string, complexPropertyId: string, childCode: string, child: Property, trace: Trace): Promise<PropertyComplexChildView | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ propertyType: properties.propertyType }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, complexPropertyId),
      )).for("update").limit(1))[0];
      if (parent === undefined) return undefined;
      if (parent.propertyType !== "COMPLEX" || child.values.structuralRole !== "STANDALONE" || child.values.tenantId !== tenantId) throw new PropertyStructuralRoleConflictError();
      await scope.database().insert(properties).values(toPropertyInsert(child, trace));
      await scope.database().insert(propertyComplexChildren).values({ tenantId, complexPropertyId, childPropertyId: child.values.propertyId,
        childCode, createdAt: child.values.createdAt, correlationId: trace.correlationId, actorId: trace.actorId });
      return { childCode, property: child.values };
    }), "complexChild");
  }

  listComplexChildren(tenantId: string, complexPropertyId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<PropertyComplexChildView> | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ propertyType: properties.propertyType }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, complexPropertyId),
      )).limit(1))[0];
      if (parent?.propertyType !== "COMPLEX") return undefined;
      const cursorFilter = cursor === undefined ? undefined : or(gt(propertyComplexChildren.childCode, cursor.code), and(
        eq(propertyComplexChildren.childCode, cursor.code), gt(propertyComplexChildren.childPropertyId, cursor.id),
      ));
      const rows = await scope.database().select({ relation: propertyComplexChildren, property: properties }).from(propertyComplexChildren)
        .innerJoin(properties, and(eq(properties.tenantId, propertyComplexChildren.tenantId), eq(properties.propertyId, propertyComplexChildren.childPropertyId)))
        .where(and(eq(propertyComplexChildren.tenantId, tenantId), eq(propertyComplexChildren.complexPropertyId, complexPropertyId), cursorFilter))
        .orderBy(asc(propertyComplexChildren.childCode), asc(propertyComplexChildren.childPropertyId)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => ({ childCode: row.relation.childCode, property: toProperty(row.property).values }));
      const last = rows.length > limit ? items.at(-1) : undefined;
      return { items, ...(last === undefined ? {} : { nextCursor: { code: last.childCode, id: last.property.propertyId } }) };
    });
  }

  saveComposite(property: Property, building: PropertyBuilding | undefined, trace: Trace): Promise<void> {
    return withTenantPostgresTransaction(this.pool, property.values.tenantId, async (scope) => {
      await scope.database().insert(properties).values(toPropertyInsert(property, trace));
      if (building !== undefined) {
        if (building.values.propertyId !== property.values.propertyId || building.values.buildingPropertyId !== property.values.propertyId) {
          throw new InvalidPropertyCompositionServerValueError("buildingPropertyId");
        }
        await scope.database().insert(propertyBuildings).values({ ...building.values, correlationId: trace.correlationId, actorId: trace.actorId });
      }
    });
  }

  createBuilding(tenantId: string, propertyId: string, building: PropertyBuilding, trace: Trace, buildingProperty?: Property): Promise<PropertyBuilding | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const locked = (await scope.database().select().from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0];
      if (locked === undefined) return undefined;
      if (locked.propertyType === "BUILDING") throw new PropertyStructuralRoleConflictError();
      const lockedParent = toProperty(locked).becomeComposite(building.values.updatedAt);
      if (lockedParent.values.structuralRole !== locked.structuralRole) await scope.database().update(properties).set({
        structuralRole: "COMPOSITE",
        availabilityStatus: null,
        occupancyStatus: null,
        availabilityUpdatedAt: null,
        availabilityUpdatedByActorId: null,
        availabilityCorrelationId: null,
        updatedAt: building.values.updatedAt,
        correlationId: trace.correlationId,
        actorId: trace.actorId,
      }).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)));
      if (buildingProperty !== undefined) {
        if (buildingProperty.values.tenantId !== tenantId || buildingProperty.values.propertyId !== building.values.buildingPropertyId) {
          throw new InvalidPropertyCompositionServerValueError("buildingPropertyId");
        }
        await scope.database().insert(properties).values(toPropertyInsert(buildingProperty, trace));
      }
      await scope.database().insert(propertyBuildings).values({ ...building.values, correlationId: trace.correlationId, actorId: trace.actorId });
      return building;
    }), "building");
  }

  listBuildings(tenantId: string, propertyId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<Readonly<PropertyBuilding["values"]>> | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).limit(1))[0];
      if (parent === undefined) return undefined;
      const cursorFilter = cursor === undefined ? undefined : or(gt(propertyBuildings.buildingCode, cursor.code), and(eq(propertyBuildings.buildingCode, cursor.code), gt(propertyBuildings.buildingId, cursor.id)));
      const rows = await scope.database().select().from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)), cursorFilter)).orderBy(asc(propertyBuildings.buildingCode), asc(propertyBuildings.buildingId)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => PropertyBuilding.rehydrate(toBuildingValues(row)).values); const last = rows.length > limit ? items.at(-1) : undefined;
      return { items, ...(last === undefined ? {} : { nextCursor: { code: last.buildingCode, id: last.buildingId } }) };
    });
  }

  updateBuilding(tenantId: string, propertyId: string, buildingId: string, update: (building: PropertyBuilding) => PropertyBuilding, trace: Trace): Promise<PropertyBuilding | undefined> {
    return this.conflicts(() => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const parent = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId))).for("update").limit(1))[0];
      if (parent === undefined) return undefined;
      const row = (await scope.database().select().from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0];
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
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0];
      if (building === undefined) return undefined; const value = unit.values;
      await scope.database().insert(properties).values({ propertyId: value.propertyId, tenantId, title: value.title, description: value.description, propertyType: value.propertyType, transactionType: value.transactionType, apartmentSubtype: value.apartmentSubtype, status: value.status, structuralRole: "UNIT", country: value.location.country, city: value.location.city, district: value.location.district, addressLine: value.location.addressLine, createdAt: value.createdAt, updatedAt: value.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId });
      await scope.database().insert(propertyBuildingUnits).values({ ...relation.values, correlationId: trace.correlationId, actorId: trace.actorId });
      return { unitCode, property: value };
    }), "unit");
  }

  listUnits(tenantId: string, propertyId: string, buildingId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<PropertyUnitView> | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)), eq(propertyBuildings.buildingId, buildingId))).limit(1))[0];
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
      const building = (await scope.database().select({ id: propertyBuildings.buildingId }).from(propertyBuildings).where(and(eq(propertyBuildings.tenantId, tenantId), or(eq(propertyBuildings.propertyId, propertyId), eq(propertyBuildings.buildingPropertyId, propertyId)), eq(propertyBuildings.buildingId, buildingId))).for("update").limit(1))[0]; if (building === undefined) return undefined;
      const property = (await scope.database().select().from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, unitPropertyId))).limit(1))[0]; if (property === undefined) return undefined;
      const unit = toProperty(property);
      const relationRow = (await scope.database().select().from(propertyBuildingUnits).where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.buildingId, buildingId), eq(propertyBuildingUnits.unitPropertyId, unitPropertyId))).for("update").limit(1))[0]; if (relationRow === undefined) return undefined;
      const relation = PropertyBuildingUnit.rehydrate(toUnitValues(relationRow), unit).updateCode(unitCode, updatedAt);
      await scope.database().update(propertyBuildingUnits).set({ unitCode: relation.values.unitCode, updatedAt: relation.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId }).where(and(eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.buildingId, buildingId), eq(propertyBuildingUnits.unitPropertyId, unitPropertyId)));
      return { unitCode: relation.values.unitCode, property: unit.values };
    }), "unit");
  }

  private async conflicts<T>(operation: () => Promise<T>, kind: "building" | "unit" | "complexChild"): Promise<T> {
    try { return await operation(); } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (kind === "building" && constraint === "property_buildings_tenant_property_code_unique") {
        throw new PropertyBuildingCodeConflictError();
      }
      if (kind === "unit" && constraint === "property_building_units_tenant_building_code_unique") {
        throw new PropertyUnitCodeConflictError();
      }
      if (kind === "complexChild" && constraint === "property_complex_children_tenant_complex_code_unique") {
        throw new PropertyComplexChildCodeConflictError();
      }
      throw error;
    }
  }
}
type BuildingRow = typeof propertyBuildings.$inferSelect;
function toBuildingValues(row: BuildingRow) { return { buildingId: row.buildingId, tenantId: row.tenantId, propertyId: row.propertyId, ...(row.buildingPropertyId === null ? {} : { buildingPropertyId: row.buildingPropertyId }), buildingCode: row.buildingCode, name: row.name, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() }; }
function toPropertyInsert(property: Property, trace: Trace) {
  const value = property.values;
  return {
    propertyId: value.propertyId, tenantId: value.tenantId, title: value.title, description: value.description,
    propertyType: value.propertyType, commercializationMode: value.commercializationMode, transactionType: value.transactionType, apartmentSubtype: value.apartmentSubtype,
    status: value.status, structuralRole: value.structuralRole,
    country: value.location.country, city: value.location.city, district: value.location.district,
    addressLine: value.location.addressLine, createdAt: value.createdAt, updatedAt: value.updatedAt,
    correlationId: trace.correlationId, actorId: trace.actorId,
  };
}
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
