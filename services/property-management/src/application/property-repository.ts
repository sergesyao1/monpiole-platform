import type { Property } from "../domain/property.js";

export interface PropertyRepository {
  saveStandalone(property: Property, correlationId: string, actorId: string): Promise<void>;
  findById(tenantId: string, propertyId: string): Promise<Property | undefined>;
  updateAtomically(
    tenantId: string,
    propertyId: string,
    update: (property: Property) => Property,
    trace: { readonly correlationId: string; readonly actorId: string },
  ): Promise<Property | undefined>;
}
