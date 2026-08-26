import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnershipRepository } from "./property-ownership-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface RemovePropertyOwnerCommand {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
  readonly ownerId: string;
}
export class PropertyOwnershipNotFoundError extends Error { readonly code = "PROPERTY_OWNERSHIP_NOT_FOUND"; }

export class RemovePropertyOwner {
  constructor(private readonly repository: PropertyOwnershipRepository) {}
  async execute(command: RemovePropertyOwnerCommand): Promise<void> {
    const tenantId = authorizedTenant(command.authority, "REMOVE_PROPERTY_OWNER");
    const result = await this.repository.removeAtomically(tenantId, command.propertyId, command.ownerId);
    if (result === "PROPERTY_NOT_FOUND") throw new PropertyNotFoundError();
    if (result === "OWNERSHIP_NOT_FOUND") throw new PropertyOwnershipNotFoundError();
  }
}
