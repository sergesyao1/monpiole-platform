import type { CommercialTerms, PropertyDetails } from "../domain/property-details.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyView } from "./create-property.js";
import { PropertyNotFoundError } from "./retrieve-property.js";
import type { PropertyRepository } from "./property-repository.js";

export interface UpdatePropertyDetailsCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
  readonly details: PropertyDetails;
  readonly commercialTerms?: CommercialTerms;
}

export class UpdatePropertyDetails {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}
  async execute(command: UpdatePropertyDetailsCommand): Promise<PropertyView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_DETAILS");
    const updated = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (property) => property.defineDetails(command.details, command.commercialTerms, this.clock.now()),
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (updated === undefined) throw new PropertyNotFoundError();
    return updated.values;
  }
}
