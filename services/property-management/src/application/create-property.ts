import { Property, type ApartmentSubtype, type BuildingCommercializationMode, type PropertyLocation, type PropertyType, type TransactionType } from "../domain/property.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyBuilding } from "../domain/property-building.js";

export interface CreatePropertyCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly commercializationMode?: BuildingCommercializationMode;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly location: PropertyLocation;
}
export type PropertyView = Readonly<Property["values"]>;
export interface PropertyIdentifierGenerator { generate(): string; }
export interface PropertyClock { now(): string; }
export interface PropertyStructureCreation {
  saveComposite(property: Property, building: PropertyBuilding | undefined, trace: { readonly correlationId: string; readonly actorId: string }): Promise<void>;
}

export class CreateProperty {
  constructor(private readonly repository: PropertyRepository, private readonly identifiers: PropertyIdentifierGenerator, private readonly clock: PropertyClock, private readonly structures?: PropertyStructureCreation) {}
  async execute(command: CreatePropertyCommand): Promise<PropertyView> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY");
    const now = this.clock.now();
    const fields = {
      propertyId: this.identifiers.generate(), tenantId, title: command.title,
      ...(command.description === undefined ? {} : { description: command.description }),
      propertyType: command.propertyType, transactionType: command.transactionType,
      ...(command.commercializationMode === undefined ? {} : { commercializationMode: command.commercializationMode }),
      ...(command.apartmentSubtype === undefined ? {} : { apartmentSubtype: command.apartmentSubtype }),
      location: command.location, createdAt: now, updatedAt: now,
    };
    if (command.propertyType === "BUILDING" || command.propertyType === "COMPLEX") {
      const property = Property.createComposite(fields);
      if (this.structures === undefined) throw new Error("Property structure persistence is unavailable");
      const building = command.propertyType === "BUILDING" ? PropertyBuilding.create({
        buildingId: this.identifiers.generate(), tenantId, propertyId: property.values.propertyId,
        buildingPropertyId: property.values.propertyId, buildingCode: "MAIN", name: property.values.title,
        createdAt: now, updatedAt: now,
      }) : undefined;
      await this.structures.saveComposite(property, building, { correlationId: command.correlationId, actorId: command.authority.actorId });
      return property.values;
    }
    const property = Property.createStandalone(fields);
    await this.repository.saveStandalone(property, command.correlationId, command.authority.actorId);
    return property.values;
  }
}
