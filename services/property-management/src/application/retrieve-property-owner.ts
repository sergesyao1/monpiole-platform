import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnerView } from "./create-property-owner.js";
import type { PropertyOwnerRepository } from "./property-owner-repository.js";

export interface RetrievePropertyOwnerQuery { readonly authority: PropertyAuthority; readonly ownerId: string; }
export class PropertyOwnerNotFoundError extends Error { readonly code = "PROPERTY_OWNER_NOT_FOUND"; }

export class RetrievePropertyOwner {
  constructor(private readonly repository: PropertyOwnerRepository) {}
  async execute(query: RetrievePropertyOwnerQuery): Promise<PropertyOwnerView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_OWNER");
    const owner = await this.repository.findById(tenantId, query.ownerId);
    if (owner === undefined) throw new PropertyOwnerNotFoundError();
    return owner.values;
  }
}
