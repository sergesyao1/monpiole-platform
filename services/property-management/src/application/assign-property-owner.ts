import { PropertyOwnership } from "../domain/property-ownership.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnerClock } from "./create-property-owner.js";
import type { PropertyOwnershipRepository } from "./property-ownership-repository.js";
import { PropertyOwnerNotFoundError } from "./retrieve-property-owner.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface AssignPropertyOwnerCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
  readonly ownerId: string;
  readonly ownershipShare: number;
}
export type PropertyOwnershipView = Readonly<PropertyOwnership["values"]>;

export class PropertyOwnershipConflictError extends Error { readonly code = "PROPERTY_OWNERSHIP_CONFLICT"; }

export class AssignPropertyOwner {
  constructor(private readonly repository: PropertyOwnershipRepository, private readonly clock: PropertyOwnerClock) {}
  async execute(command: AssignPropertyOwnerCommand): Promise<PropertyOwnershipView> {
    const tenantId = authorizedTenant(command.authority, "ASSIGN_PROPERTY_OWNER");
    const ownership = PropertyOwnership.create({
      tenantId, propertyId: command.propertyId, ownerId: command.ownerId,
      ownershipShare: command.ownershipShare, createdAt: this.clock.now(),
      correlationId: command.correlationId, actorId: command.authority.actorId,
    });
    const result = await this.repository.assignAtomically(ownership);
    if (result === "PROPERTY_NOT_FOUND") throw new PropertyNotFoundError();
    if (result === "OWNER_NOT_FOUND") throw new PropertyOwnerNotFoundError();
    if (result === "DUPLICATE") throw new PropertyOwnershipConflictError();
    return ownership.values;
  }
}
