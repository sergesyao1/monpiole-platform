import { Property, type ApartmentSubtype, type PropertyLocation, type PropertyType, type TransactionType } from "../domain/property.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyRepository } from "./property-repository.js";

export interface CreatePropertyCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly location: PropertyLocation;
}
export type PropertyView = Readonly<Property["values"]>;
export interface PropertyIdentifierGenerator { generate(): string; }
export interface PropertyClock { now(): string; }

export class CreateProperty {
  constructor(private readonly repository: PropertyRepository, private readonly identifiers: PropertyIdentifierGenerator, private readonly clock: PropertyClock) {}
  async execute(command: CreatePropertyCommand): Promise<PropertyView> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY");
    const now = this.clock.now();
    const property = Property.createStandalone({
      propertyId: this.identifiers.generate(), tenantId, title: command.title,
      ...(command.description === undefined ? {} : { description: command.description }),
      propertyType: command.propertyType, transactionType: command.transactionType,
      ...(command.apartmentSubtype === undefined ? {} : { apartmentSubtype: command.apartmentSubtype }),
      location: command.location, createdAt: now, updatedAt: now,
    });
    await this.repository.saveStandalone(property, command.correlationId, command.authority.actorId);
    return property.values;
  }
}
