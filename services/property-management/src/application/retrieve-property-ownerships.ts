import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnershipView } from "./assign-property-owner.js";
import type { PropertyOwnershipRepository } from "./property-ownership-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface RetrievePropertyOwnershipsQuery { readonly authority: PropertyAuthority; readonly propertyId: string; }

export class RetrievePropertyOwnerships {
  constructor(private readonly repository: PropertyOwnershipRepository) {}
  async execute(query: RetrievePropertyOwnershipsQuery): Promise<readonly PropertyOwnershipView[]> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_OWNERSHIP");
    const ownerships = await this.repository.listByProperty(tenantId, query.propertyId);
    if (ownerships === undefined) throw new PropertyNotFoundError();
    return ownerships.map((ownership) => ownership.values);
  }
}
