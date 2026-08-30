import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyView } from "./create-property.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface PublishPropertyCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
}

export interface PublishPropertyResult {
  readonly property: PropertyView;
  readonly outcome: "PUBLISHED" | "ALREADY_PUBLISHED";
}

export class PublishProperty {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}

  async execute(command: PublishPropertyCommand): Promise<PublishPropertyResult> {
    const tenantId = authorizedTenant(command.authority, "PUBLISH_PROPERTY");
    let outcome: PublishPropertyResult["outcome"] = "ALREADY_PUBLISHED";
    const property = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (current, photos, standardOverride) => {
        if (current.values.status === "PUBLISHED") return current;
        outcome = "PUBLISHED";
        return current.publish(this.clock.now(), photos, standardOverride);
      },
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (property === undefined) throw new PropertyNotFoundError();
    return { property: property.values, outcome };
  }
}
