import type { PropertyOwner } from "../domain/property-owner.js";

export class PropertyOwnerPersistenceFailureError extends Error {
  readonly code = "PROPERTY_OWNER_PERSISTENCE_FAILURE";
  constructor() { super("Property owner persistence failed"); }
}

export interface PropertyOwnerRepository {
  save(owner: PropertyOwner, correlationId: string, actorId: string): Promise<void>;
  findById(tenantId: string, ownerId: string): Promise<PropertyOwner | undefined>;
  updateAtomically(
    tenantId: string,
    ownerId: string,
    update: (owner: PropertyOwner) => PropertyOwner,
    trace: { readonly correlationId: string; readonly actorId: string },
  ): Promise<PropertyOwner | undefined>;
}
