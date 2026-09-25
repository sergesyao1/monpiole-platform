import type { PropertyOwnerContactInformation, PropertyOwnerIdentity } from "../domain/property-owner.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnerClock, PropertyOwnerView } from "./create-property-owner.js";
import type { PropertyOwnerRepository } from "./property-owner-repository.js";
import { PropertyOwnerNotFoundError } from "./retrieve-property-owner.js";

export interface UpdatePropertyOwnerCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly ownerId: string;
  readonly identity: PropertyOwnerIdentity;
  readonly contactInformation: PropertyOwnerContactInformation;
}

export class UpdatePropertyOwner {
  constructor(private readonly repository: PropertyOwnerRepository, private readonly clock: PropertyOwnerClock) {}
  async execute(command: UpdatePropertyOwnerCommand): Promise<PropertyOwnerView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_OWNER");
    const updated = await this.repository.updateAtomically(
      tenantId, command.ownerId,
      (owner) => owner.update(command.identity, command.contactInformation, this.clock.now()),
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (updated === undefined) throw new PropertyOwnerNotFoundError();
    return updated.values;
  }
}
