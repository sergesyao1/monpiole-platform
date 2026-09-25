import { PropertyOwner, type PropertyOwnerContactInformation, type PropertyOwnerIdentity } from "../domain/property-owner.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyOwnerRepository } from "./property-owner-repository.js";

export interface CreatePropertyOwnerCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly identity: PropertyOwnerIdentity;
  readonly contactInformation: PropertyOwnerContactInformation;
}
export type PropertyOwnerView = Readonly<PropertyOwner["values"]>;
export interface PropertyOwnerIdentifierGenerator { generate(): string; }
export interface PropertyOwnerClock { now(): string; }

export class CreatePropertyOwner {
  constructor(
    private readonly repository: PropertyOwnerRepository,
    private readonly identifiers: PropertyOwnerIdentifierGenerator,
    private readonly clock: PropertyOwnerClock,
  ) {}

  async execute(command: CreatePropertyOwnerCommand): Promise<PropertyOwnerView> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_OWNER");
    const now = this.clock.now();
    const owner = PropertyOwner.create({
      ownerId: this.identifiers.generate(), tenantId, identity: command.identity,
      contactInformation: command.contactInformation, createdAt: now, updatedAt: now,
    });
    await this.repository.save(owner, command.correlationId, command.authority.actorId);
    return owner.values;
  }
}
