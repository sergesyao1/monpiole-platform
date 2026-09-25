import type { PropertyOwnerContactInformation, PropertyOwnerIdentity } from "../domain/property-owner.js";

export interface PropertyOwnerDirectoryCursor {
  readonly createdAt: string;
  readonly ownerId: string;
}

export interface PropertyOwnerDirectoryItem {
  readonly ownerId: string;
  readonly identity: PropertyOwnerIdentity;
  readonly contactInformation: PropertyOwnerContactInformation;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PropertyOwnerDirectoryCriteria {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: PropertyOwnerDirectoryCursor;
  readonly search?: string;
}

export interface PropertyOwnerDirectoryPage {
  readonly items: readonly PropertyOwnerDirectoryItem[];
  readonly nextCursor?: PropertyOwnerDirectoryCursor;
}

export interface PropertyOwnerDirectoryQuery {
  list(criteria: PropertyOwnerDirectoryCriteria): Promise<PropertyOwnerDirectoryPage>;
}
