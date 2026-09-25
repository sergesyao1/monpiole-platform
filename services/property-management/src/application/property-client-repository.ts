import type { PropertyClient } from "../domain/property-client.js";

export interface PropertyClientDirectoryCursor {
  readonly createdAt: string;
  readonly clientId: string;
}

export interface PropertyClientDirectoryCriteria {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: PropertyClientDirectoryCursor;
  readonly search?: string;
}

export interface PropertyClientDirectoryPage {
  readonly items: readonly PropertyClient[];
  readonly nextCursor?: PropertyClientDirectoryCursor;
}

export interface PropertyClientRepository {
  save(client: PropertyClient, correlationId: string, actorId: string): Promise<void>;
  findById(tenantId: string, clientId: string): Promise<PropertyClient | undefined>;
  list(criteria: PropertyClientDirectoryCriteria): Promise<PropertyClientDirectoryPage>;
}

export class PropertyClientPersistenceFailureError extends Error {
  readonly code = "PROPERTY_CLIENT_PERSISTENCE_FAILURE";
  constructor() { super("Property client persistence failed"); }
}
