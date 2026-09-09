import { amenityCatalog, validateAmenityCodes, type Amenity, type AmenityCode } from "../domain/property-amenity.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface PropertyAmenityRepository {
  findCodes(tenantId: string, propertyId: string): Promise<readonly AmenityCode[] | undefined>;
  replace(tenantId: string, propertyId: string, codes: readonly AmenityCode[], trace: { readonly actorId: string; readonly correlationId: string; readonly updatedAt: string }): Promise<readonly AmenityCode[] | undefined>;
}
export class RetrieveAmenityCatalog { execute(): readonly Amenity[] { return amenityCatalog(); } }
export class RetrievePropertyAmenities {
  constructor(private readonly repository: PropertyAmenityRepository) {}
  async execute(query: { readonly authority: PropertyAuthority; readonly propertyId: string }): Promise<readonly AmenityCode[]> {
    const result = await this.repository.findCodes(authorizedTenant(query.authority, "RETRIEVE_PROPERTY_AMENITIES"), query.propertyId);
    if (result === undefined) throw new PropertyNotFoundError(); return result;
  }
}
export class ReplacePropertyAmenities {
  constructor(private readonly repository: PropertyAmenityRepository, private readonly clock: { now(): string }) {}
  async execute(command: { readonly authority: PropertyAuthority; readonly propertyId: string; readonly amenityCodes: readonly string[]; readonly correlationId: string }): Promise<readonly AmenityCode[]> {
    const codes = validateAmenityCodes(command.amenityCodes);
    const result = await this.repository.replace(authorizedTenant(command.authority, "UPDATE_PROPERTY_AMENITIES"), command.propertyId, codes, { actorId: command.authority.actorId, correlationId: command.correlationId, updatedAt: this.clock.now() });
    if (result === undefined) throw new PropertyNotFoundError(); return result;
  }
}
