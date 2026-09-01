import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyView } from "./create-property.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyNotPublishedError } from "../domain/property.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface WithdrawPropertyFromCatalogCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
}

export interface WithdrawPropertyFromCatalogResult {
  readonly property: PropertyView;
  readonly outcome: "WITHDRAWN" | "ALREADY_WITHDRAWN";
}

export class WithdrawPropertyFromCatalog {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}

  async execute(command: WithdrawPropertyFromCatalogCommand): Promise<WithdrawPropertyFromCatalogResult> {
    const tenantId = authorizedTenant(command.authority, "WITHDRAW_PROPERTY_FROM_CATALOG");
    let outcome: WithdrawPropertyFromCatalogResult["outcome"] = "ALREADY_WITHDRAWN";
    const property = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (current) => {
        if (current.values.status === "WITHDRAWN") return current;
        if (current.values.status === "DRAFT") throw new PropertyNotPublishedError();
        outcome = "WITHDRAWN";
        return current.withdraw(this.clock.now());
      },
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (property === undefined) throw new PropertyNotFoundError();
    return { property: property.values, outcome };
  }
}
