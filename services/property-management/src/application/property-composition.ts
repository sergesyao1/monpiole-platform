import { Property, type PropertyLocation, type PropertyType, type TransactionType } from "../domain/property.js";
import { PropertyBuilding, normalizeStructuralCode } from "../domain/property-building.js";
import { PropertyBuildingUnit } from "../domain/property-building-unit.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { CompositionCursor, PropertyCompositionRepository } from "./property-composition-repository.js";
import { PropertyBuildingNotFoundError, PropertyUnitNotFoundError } from "./property-composition-repository.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface CompositionIdentifiers { generate(): string; }
export interface CompositionClock { now(): string; }
export interface CompositionContext { readonly authority: PropertyAuthority; readonly correlationId: string; }

export class CreatePropertyBuilding {
  constructor(private readonly properties: PropertyRepository, private readonly composition: PropertyCompositionRepository, private readonly ids: CompositionIdentifiers, private readonly clock: CompositionClock) {}
  async execute(command: CompositionContext & { readonly propertyId: string; readonly buildingCode: string; readonly name: string }) {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_BUILDING");
    const parent = await this.properties.findById(tenantId, command.propertyId);
    if (parent === undefined) throw new PropertyNotFoundError();
    const now = this.clock.now();
    const result = await this.composition.createBuilding(tenantId, command.propertyId, PropertyBuilding.create({ buildingId: this.ids.generate(), tenantId, propertyId: command.propertyId, buildingCode: command.buildingCode, name: command.name, createdAt: now, updatedAt: now }), trace(command));
    if (result === undefined) throw new PropertyNotFoundError();
    return result.values;
  }
}

export class ListPropertyBuildings {
  constructor(private readonly composition: PropertyCompositionRepository) {}
  async execute(query: CompositionContext & { readonly propertyId: string; readonly limit: number; readonly cursor?: CompositionCursor }) {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_COMPOSITION");
    const page = await this.composition.listBuildings(tenantId, query.propertyId, query.limit, query.cursor);
    if (page === undefined) throw new PropertyNotFoundError(); return page;
  }
}

export class UpdatePropertyBuilding {
  constructor(private readonly composition: PropertyCompositionRepository, private readonly clock: CompositionClock) {}
  async execute(command: CompositionContext & { readonly propertyId: string; readonly buildingId: string; readonly buildingCode: string; readonly name: string }) {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_BUILDING");
    const result = await this.composition.updateBuilding(tenantId, command.propertyId, command.buildingId, (building) => building.update({ buildingCode: command.buildingCode, name: command.name, updatedAt: this.clock.now() }), trace(command));
    if (result === undefined) throw new PropertyBuildingNotFoundError(); return result.values;
  }
}

export interface CreateUnitFields { readonly unitCode: string; readonly title: string; readonly description?: string; readonly propertyType: PropertyType; readonly transactionType: TransactionType; readonly location: PropertyLocation; }
export class CreatePropertyUnit {
  constructor(private readonly composition: PropertyCompositionRepository, private readonly ids: CompositionIdentifiers, private readonly clock: CompositionClock) {}
  async execute(command: CompositionContext & { readonly propertyId: string; readonly buildingId: string } & CreateUnitFields) {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_UNIT"); const now = this.clock.now();
    const unit = Property.createUnit({ propertyId: this.ids.generate(), tenantId, title: command.title, ...(command.description === undefined ? {} : { description: command.description }), propertyType: command.propertyType, transactionType: command.transactionType, location: command.location, createdAt: now, updatedAt: now });
    const relation = PropertyBuildingUnit.create({
      tenantId,
      buildingId: command.buildingId,
      unitPropertyId: unit.values.propertyId,
      unitCode: command.unitCode,
      createdAt: now,
      updatedAt: now,
    }, unit);
    const result = await this.composition.createUnit(tenantId, command.propertyId, relation, unit, trace(command));
    if (result === undefined) throw new PropertyBuildingNotFoundError(); return result;
  }
}

export class ListPropertyUnits {
  constructor(private readonly composition: PropertyCompositionRepository) {}
  async execute(query: CompositionContext & { readonly propertyId: string; readonly buildingId: string; readonly limit: number; readonly cursor?: CompositionCursor }) {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_COMPOSITION");
    const page = await this.composition.listUnits(tenantId, query.propertyId, query.buildingId, query.limit, query.cursor);
    if (page === undefined) throw new PropertyBuildingNotFoundError(); return page;
  }
}

export class UpdatePropertyUnitStructure {
  constructor(private readonly composition: PropertyCompositionRepository, private readonly clock: CompositionClock) {}
  async execute(command: CompositionContext & { readonly propertyId: string; readonly buildingId: string; readonly unitPropertyId: string; readonly unitCode: string }) {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_UNIT_STRUCTURE");
    const result = await this.composition.updateUnitCode(tenantId, command.propertyId, command.buildingId, command.unitPropertyId, normalizeStructuralCode(command.unitCode, "unitCode"), this.clock.now(), trace(command));
    if (result === undefined) throw new PropertyUnitNotFoundError(); return result;
  }
}
function trace(value: CompositionContext) { return { correlationId: value.correlationId, actorId: value.authority.actorId }; }
