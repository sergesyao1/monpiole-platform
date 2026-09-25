import type { Property } from "../domain/property.js";
import type { PropertyBuilding } from "../domain/property-building.js";
import type { PropertyBuildingUnit } from "../domain/property-building-unit.js";

export interface CompositionCursor { readonly code: string; readonly id: string; }
export interface CompositionPage<T> { readonly items: readonly T[]; readonly nextCursor?: CompositionCursor; }
export interface PropertyUnitView {
  readonly unitCode: string;
  readonly property: Readonly<Property["values"]>;
}
export interface PropertyComplexChildView {
  readonly childCode: string;
  readonly property: Readonly<Property["values"]>;
}

export interface PropertyCompositionRepository {
  createBuilding(tenantId: string, propertyId: string, building: PropertyBuilding, trace: Trace, buildingProperty?: Property): Promise<PropertyBuilding | undefined>;
  listBuildings(tenantId: string, propertyId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<Readonly<PropertyBuilding["values"]>> | undefined>;
  updateBuilding(tenantId: string, propertyId: string, buildingId: string, update: (building: PropertyBuilding) => PropertyBuilding, trace: Trace): Promise<PropertyBuilding | undefined>;
  createUnit(tenantId: string, propertyId: string, relation: PropertyBuildingUnit, unit: Property, trace: Trace): Promise<PropertyUnitView | undefined>;
  listUnits(tenantId: string, propertyId: string, buildingId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<PropertyUnitView> | undefined>;
  updateUnitCode(tenantId: string, propertyId: string, buildingId: string, unitPropertyId: string, unitCode: string, updatedAt: string, trace: Trace): Promise<PropertyUnitView | undefined>;
  createComplexChild(tenantId: string, complexPropertyId: string, childCode: string, child: Property, trace: Trace): Promise<PropertyComplexChildView | undefined>;
  listComplexChildren(tenantId: string, complexPropertyId: string, limit: number, cursor?: CompositionCursor): Promise<CompositionPage<PropertyComplexChildView> | undefined>;
}
export interface Trace { readonly correlationId: string; readonly actorId: string; }

export class PropertyBuildingNotFoundError extends Error { readonly code = "PROPERTY_BUILDING_NOT_FOUND"; }
export class PropertyUnitNotFoundError extends Error { readonly code = "PROPERTY_UNIT_NOT_FOUND"; }
export class PropertyBuildingCodeConflictError extends Error { readonly code = "PROPERTY_BUILDING_CODE_CONFLICT"; }
export class PropertyUnitCodeConflictError extends Error { readonly code = "PROPERTY_UNIT_CODE_CONFLICT"; }
export class PropertyComplexChildCodeConflictError extends Error { readonly code = "PROPERTY_COMPLEX_CHILD_CODE_CONFLICT"; }
