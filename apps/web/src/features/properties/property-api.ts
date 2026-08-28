import { createAuthenticatedApiClient, type AccessTokenProvider } from "../../infrastructure/http/api-client.js";
import type {
  CreatePropertyInput, Property, PropertyOwner, PropertyOwnerDirectoryCriteria, PropertyOwnerDirectoryPage,
  PropertyOwnerInput, PropertyOwnership, PropertyPortfolioCriteria, PropertyPortfolioPage, UpdatePropertyDetailsInput,
  UpdatePropertyCoreInformationInput,
} from "./property-model.js";

export interface PropertyApi {
  listProperties(criteria?: PropertyPortfolioCriteria): Promise<PropertyPortfolioPage>;
  createProperty(input: CreatePropertyInput): Promise<Property>;
  retrieveProperty(propertyId: string): Promise<Property>;
  updatePropertyDetails(propertyId: string, input: UpdatePropertyDetailsInput): Promise<Property>;
  updatePropertyCoreInformation(propertyId: string, input: UpdatePropertyCoreInformationInput): Promise<Property>;
  retrieveOwnerships(propertyId: string): Promise<readonly PropertyOwnership[]>;
  retrievePropertyOwner(ownerId: string): Promise<PropertyOwner>;
  listPropertyOwners(criteria?: PropertyOwnerDirectoryCriteria): Promise<PropertyOwnerDirectoryPage>;
  createPropertyOwner(input: PropertyOwnerInput): Promise<PropertyOwner>;
  updatePropertyOwner(ownerId: string, input: PropertyOwnerInput): Promise<PropertyOwner>;
  assignPropertyOwner(propertyId: string, ownerId: string, ownershipShare: number): Promise<PropertyOwnership>;
  removePropertyOwner(propertyId: string, ownerId: string): Promise<void>;
}

export function createPropertyApi(tokens: AccessTokenProvider): PropertyApi {
  const request = createAuthenticatedApiClient(tokens);
  return {
    listProperties: (criteria = {}) => request<PropertyPortfolioPage>(portfolioPath(criteria)),
    createProperty: (input) => request<Property>("/v1/properties", { method: "POST", body: input }),
    retrieveProperty: (propertyId) => request<Property>(`/v1/properties/${encodeURIComponent(propertyId)}`),
    updatePropertyDetails: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/details`, { method: "PUT", body: input },
    ),
    updatePropertyCoreInformation: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}`, { method: "PUT", body: input },
    ),
    retrieveOwnerships: (propertyId) => request<readonly PropertyOwnership[]>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners`,
    ),
    retrievePropertyOwner: (ownerId) => request<PropertyOwner>(`/v1/property-owners/${encodeURIComponent(ownerId)}`),
    listPropertyOwners: (criteria = {}) => request<PropertyOwnerDirectoryPage>(ownerDirectoryPath(criteria)),
    createPropertyOwner: (input) => request<PropertyOwner>("/v1/property-owners", { method: "POST", body: input }),
    updatePropertyOwner: (ownerId, input) => request<PropertyOwner>(
      `/v1/property-owners/${encodeURIComponent(ownerId)}`, { method: "PUT", body: input },
    ),
    assignPropertyOwner: (propertyId, ownerId, ownershipShare) => request<PropertyOwnership>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners`,
      { method: "POST", body: { ownerId, ownershipShare } },
    ),
    removePropertyOwner: (propertyId, ownerId) => request<void>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners/${encodeURIComponent(ownerId)}`, { method: "DELETE" },
    ),
  };
}

function ownerDirectoryPath(criteria: PropertyOwnerDirectoryCriteria): `/v1/${string}` {
  const query = new URLSearchParams();
  if (criteria.limit !== undefined) query.set("limit", String(criteria.limit));
  if (criteria.cursor !== undefined) query.set("cursor", criteria.cursor);
  if (criteria.search !== undefined) query.set("search", criteria.search);
  const encoded = query.toString();
  return encoded.length === 0 ? "/v1/property-owners" : `/v1/property-owners?${encoded}`;
}

function portfolioPath(criteria: PropertyPortfolioCriteria): `/v1/${string}` {
  const query = new URLSearchParams();
  if (criteria.limit !== undefined) query.set("limit", String(criteria.limit));
  if (criteria.cursor !== undefined) query.set("cursor", criteria.cursor);
  if (criteria.status !== undefined) query.set("status", criteria.status);
  if (criteria.type !== undefined) query.set("type", criteria.type);
  if (criteria.search !== undefined) query.set("search", criteria.search);
  const encoded = query.toString();
  return encoded.length === 0 ? "/v1/properties" : `/v1/properties?${encoded}`;
}
