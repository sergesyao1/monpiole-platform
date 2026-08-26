import type { Property } from "../domain/property.js";

export interface PropertyRepository {
  save(property: Property, correlationId: string, actorId: string): Promise<void>;
  findById(tenantId: string, propertyId: string): Promise<Property | undefined>;
}
