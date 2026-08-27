import { createAuthenticatedApiClient, type AccessTokenProvider } from "../../infrastructure/http/api-client.js";
import type {
  CreatePropertyInput, Property, PropertyOwner, PropertyOwnership, UpdatePropertyDetailsInput,
} from "./property-model.js";

export interface PropertyApi {
  createProperty(input: CreatePropertyInput): Promise<Property>;
  retrieveProperty(propertyId: string): Promise<Property>;
  updatePropertyDetails(propertyId: string, input: UpdatePropertyDetailsInput): Promise<Property>;
  retrieveOwnerships(propertyId: string): Promise<readonly PropertyOwnership[]>;
  retrievePropertyOwner(ownerId: string): Promise<PropertyOwner>;
  assignPropertyOwner(propertyId: string, ownerId: string, ownershipShare: number): Promise<PropertyOwnership>;
  removePropertyOwner(propertyId: string, ownerId: string): Promise<void>;
}

export function createPropertyApi(tokens: AccessTokenProvider): PropertyApi {
  const request = createAuthenticatedApiClient(tokens);
  return {
    createProperty: (input) => request<Property>("/v1/properties", { method: "POST", body: input }),
    retrieveProperty: (propertyId) => request<Property>(`/v1/properties/${encodeURIComponent(propertyId)}`),
    updatePropertyDetails: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/details`, { method: "PUT", body: input },
    ),
    retrieveOwnerships: (propertyId) => request<readonly PropertyOwnership[]>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners`,
    ),
    retrievePropertyOwner: (ownerId) => request<PropertyOwner>(`/v1/property-owners/${encodeURIComponent(ownerId)}`),
    assignPropertyOwner: (propertyId, ownerId, ownershipShare) => request<PropertyOwnership>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners`,
      { method: "POST", body: { ownerId, ownershipShare } },
    ),
    removePropertyOwner: (propertyId, ownerId) => request<void>(
      `/v1/properties/${encodeURIComponent(propertyId)}/owners/${encodeURIComponent(ownerId)}`, { method: "DELETE" },
    ),
  };
}
