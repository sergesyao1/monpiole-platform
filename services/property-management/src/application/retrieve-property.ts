import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyRepository } from "./property-repository.js";
import type { PropertyView } from "./create-property.js";

export interface RetrievePropertyQuery { readonly authority: PropertyAuthority; readonly propertyId: string; }
export class PropertyNotFoundError extends Error { readonly code = "PROPERTY_NOT_FOUND"; }

export class RetrieveProperty {
  constructor(private readonly repository: PropertyRepository) {}
  async execute(query: RetrievePropertyQuery): Promise<PropertyView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY");
    const property = await this.repository.findById(tenantId, query.propertyId);
    if (property === undefined) throw new PropertyNotFoundError();
    return property.values;
  }
}
