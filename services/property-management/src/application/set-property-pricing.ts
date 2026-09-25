import { sameCommercialTerms, validateCommercialTerms, type PropertyPricing } from "../domain/property-details.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyView } from "./create-property.js";
import { PropertyNotFoundError } from "./retrieve-property.js";
import type { PropertyRepository } from "./property-repository.js";

export interface SetPropertyPricingCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
  readonly pricing: PropertyPricing;
}

export class SetPropertyPricing {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}

  async execute(command: SetPropertyPricingCommand): Promise<PropertyView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_PRICING");
    const updated = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (property) => {
        const pricing = validateCommercialTerms(property.values.transactionType, command.pricing);
        return sameCommercialTerms(property.values.commercialTerms, pricing)
          ? property
          : property.setPricing(pricing, this.clock.now());
      },
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (updated === undefined) throw new PropertyNotFoundError();
    return updated.values;
  }
}
