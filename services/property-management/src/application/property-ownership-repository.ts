import type { PropertyOwnership } from "../domain/property-ownership.js";

export type AssignPropertyOwnershipResult = "ASSIGNED" | "PROPERTY_NOT_FOUND" | "OWNER_NOT_FOUND" | "DUPLICATE";
export type RemovePropertyOwnershipResult = "REMOVED" | "PROPERTY_NOT_FOUND" | "OWNERSHIP_NOT_FOUND";

export interface PropertyOwnershipRepository {
  assignAtomically(ownership: PropertyOwnership): Promise<AssignPropertyOwnershipResult>;
  listByProperty(tenantId: string, propertyId: string): Promise<readonly PropertyOwnership[] | undefined>;
  removeAtomically(tenantId: string, propertyId: string, ownerId: string): Promise<RemovePropertyOwnershipResult>;
}

export class PropertyOwnershipPersistenceFailureError extends Error {
  readonly code = "PROPERTY_OWNERSHIP_PERSISTENCE_FAILURE";
  constructor() { super("Property ownership persistence failed"); }
}
