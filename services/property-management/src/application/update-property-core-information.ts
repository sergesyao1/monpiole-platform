import type { PropertyCoreInformation } from "../domain/property.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyView } from "./create-property.js";
import { PropertyNotFoundError } from "./retrieve-property.js";
import type { PropertyRepository } from "./property-repository.js";

export interface UpdatePropertyCoreInformationCommand extends PropertyCoreInformation {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
}

export class UpdatePropertyCoreInformation {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}

  async execute(command: UpdatePropertyCoreInformationCommand): Promise<PropertyView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_CORE_INFORMATION");
    const updated = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (property) => property.updateCoreInformation({
        title: command.title,
        ...(command.description === undefined ? {} : { description: command.description }),
        location: command.location,
      }, this.clock.now()),
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (updated === undefined) throw new PropertyNotFoundError();
    return updated.values;
  }
}
