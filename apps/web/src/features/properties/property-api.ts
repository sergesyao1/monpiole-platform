import { createAuthenticatedApiClient, createAuthenticatedBinaryApiClient, type AccessTokenProvider } from "../../infrastructure/http/api-client.js";
import type {
  CreatePropertyInput, Property, PropertyOwner, PropertyOwnerDirectoryCriteria, PropertyOwnerDirectoryPage,
  PropertyOwnerInput, PropertyOwnership, PropertyPortfolioCriteria, PropertyPortfolioPage, UpdatePropertyDetailsInput,
  UpdatePropertyCoreInformationInput,
  BuildingInput, CompositionPage, PropertyBuilding, PropertyUnit, UnitInput,
  PropertyPhoto, PropertyPhotoCategory, PropertyPhotoStandard,
  PropertyGeolocation, UpdatePropertyGeolocationInput,
  PropertyAvailability, UpdatePropertyAvailabilityInput,
  PropertyPricingInput,
  PropertyClient, PropertyClientDirectoryPage, PropertyClientInput,
  PropertyContract, PropertyContractDirectoryPage, PropertyContractInput, PropertyWorkspace,
} from "./property-model.js";

export interface PropertyApi {
  listProperties(criteria?: PropertyPortfolioCriteria): Promise<PropertyPortfolioPage>;
  createProperty(input: CreatePropertyInput): Promise<Property>;
  retrieveProperty(propertyId: string): Promise<Property>;
  updatePropertyDetails(propertyId: string, input: UpdatePropertyDetailsInput): Promise<Property>;
  setPropertyPricing(propertyId: string, input: PropertyPricingInput): Promise<Property>;
  updatePropertyCoreInformation(propertyId: string, input: UpdatePropertyCoreInformationInput): Promise<Property>;
  publishProperty(propertyId: string): Promise<Property>;
  withdrawPropertyFromCatalog(propertyId: string): Promise<Property>;
  retrievePropertyGeolocation(propertyId: string): Promise<PropertyGeolocation>;
  updatePropertyGeolocation(propertyId: string, input: UpdatePropertyGeolocationInput): Promise<PropertyGeolocation>;
  removePropertyGeolocation(propertyId: string): Promise<void>;
  retrievePropertyAvailability(propertyId: string): Promise<PropertyAvailability>;
  updatePropertyAvailability(propertyId: string, input: UpdatePropertyAvailabilityInput): Promise<PropertyAvailability>;
  listPropertyPhotos(propertyId: string): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  registerPropertyPhoto(propertyId: string, input: Readonly<{
    category: PropertyPhotoCategory; contentType: PropertyPhoto["contentType"]; contentBase64: string;
  }>): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  retrievePropertyPhotoContent(photo: PropertyPhoto): Promise<Blob>;
  selectPropertyPrimaryPhoto(propertyId: string, photoId: string): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  reorderPropertyPhotos(propertyId: string, photoIds: readonly string[]): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  deletePropertyPhoto(propertyId: string, photoId: string): Promise<void>;
  retrievePropertyPhotoStandard(): Promise<PropertyPhotoStandard>;
  updatePropertyPhotoStandard(input: PropertyPhotoStandard): Promise<PropertyPhotoStandard>;
  retrieveOwnerships(propertyId: string): Promise<readonly PropertyOwnership[]>;
  retrievePropertyOwner(ownerId: string): Promise<PropertyOwner>;
  listPropertyOwners(criteria?: PropertyOwnerDirectoryCriteria): Promise<PropertyOwnerDirectoryPage>;
  createPropertyOwner(input: PropertyOwnerInput): Promise<PropertyOwner>;
  updatePropertyOwner(ownerId: string, input: PropertyOwnerInput): Promise<PropertyOwner>;
  assignPropertyOwner(propertyId: string, ownerId: string, ownershipShare: number): Promise<PropertyOwnership>;
  removePropertyOwner(propertyId: string, ownerId: string): Promise<void>;
  listBuildings(propertyId: string, cursor?: string): Promise<CompositionPage<PropertyBuilding>>;
  createBuilding(propertyId: string, input: BuildingInput): Promise<PropertyBuilding>;
  updateBuilding(propertyId: string, buildingId: string, input: BuildingInput): Promise<PropertyBuilding>;
  listUnits(propertyId: string, buildingId: string, cursor?: string): Promise<CompositionPage<PropertyUnit>>;
  createUnit(propertyId: string, buildingId: string, input: UnitInput): Promise<PropertyUnit>;
  updateUnitCode(propertyId: string, buildingId: string, unitPropertyId: string, unitCode: string): Promise<PropertyUnit>;
}

export interface PropertyClientContractApi {
  listPropertyClients(criteria?: Readonly<{ limit?: number; cursor?: string; search?: string }>): Promise<PropertyClientDirectoryPage>;
  createPropertyClient(input: PropertyClientInput): Promise<PropertyClient>;
  retrievePropertyClient(clientId: string): Promise<PropertyClient>;
  listPropertyContracts(propertyId: string, cursor?: string): Promise<PropertyContractDirectoryPage>;
  createPropertyContract(propertyId: string, input: PropertyContractInput): Promise<PropertyContract>;
  retrievePropertyContract(propertyId: string, contractId: string): Promise<PropertyContract>;
  updatePropertyContract(propertyId: string, contractId: string, input: PropertyContractInput): Promise<PropertyContract>;
  activatePropertyContract(propertyId: string, contractId: string): Promise<PropertyContract>;
  endPropertyContract(propertyId: string, contractId: string, endDate: string): Promise<PropertyContract>;
  cancelPropertyContract(propertyId: string, contractId: string): Promise<PropertyContract>;
}

export interface PropertyWorkspaceApi { retrievePropertyWorkspace(propertyId: string): Promise<PropertyWorkspace>; }
export type PropertyManagementApi = PropertyApi & PropertyClientContractApi & PropertyWorkspaceApi;

export function createPropertyApi(tokens: AccessTokenProvider): PropertyManagementApi {
  const request = createAuthenticatedApiClient(tokens);
  const requestBinary = createAuthenticatedBinaryApiClient(tokens);
  return {
    listProperties: (criteria = {}) => request<PropertyPortfolioPage>(portfolioPath(criteria)),
    createProperty: (input) => request<Property>("/v1/properties", { method: "POST", body: input }),
    retrieveProperty: (propertyId) => request<Property>(`/v1/properties/${encodeURIComponent(propertyId)}`),
    updatePropertyDetails: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/details`, { method: "PUT", body: input },
    ),
    setPropertyPricing: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/pricing`, { method: "PUT", body: input },
    ),
    updatePropertyCoreInformation: (propertyId, input) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}`, { method: "PUT", body: input },
    ),
    publishProperty: (propertyId) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/publication`, { method: "PUT" },
    ),
    withdrawPropertyFromCatalog: (propertyId) => request<Property>(
      `/v1/properties/${encodeURIComponent(propertyId)}/publication`, { method: "DELETE" },
    ),
    retrievePropertyGeolocation: (propertyId) => request<PropertyGeolocation>(
      `/v1/properties/${encodeURIComponent(propertyId)}/geolocation`,
    ),
    updatePropertyGeolocation: (propertyId, input) => request<PropertyGeolocation>(
      `/v1/properties/${encodeURIComponent(propertyId)}/geolocation`, { method: "PUT", body: input },
    ),
    removePropertyGeolocation: (propertyId) => request<void>(
      `/v1/properties/${encodeURIComponent(propertyId)}/geolocation`, { method: "DELETE" },
    ),
    retrievePropertyAvailability: (propertyId) => request<PropertyAvailability>(
      `/v1/properties/${encodeURIComponent(propertyId)}/availability`,
    ),
    updatePropertyAvailability: (propertyId, input) => request<PropertyAvailability>(
      `/v1/properties/${encodeURIComponent(propertyId)}/availability`, { method: "PUT", body: input },
    ),
    listPropertyPhotos: (propertyId) => request<{ readonly photos: readonly PropertyPhoto[] }>(
      `/v1/properties/${encodeURIComponent(propertyId)}/photos`,
    ),
    registerPropertyPhoto: (propertyId, input) => request<{ readonly photos: readonly PropertyPhoto[] }>(
      `/v1/properties/${encodeURIComponent(propertyId)}/photos`, { method: "POST", body: input },
    ),
    retrievePropertyPhotoContent: (photo) => requestBinary(photo.contentPath),
    selectPropertyPrimaryPhoto: (propertyId, photoId) => request<{ readonly photos: readonly PropertyPhoto[] }>(
      `/v1/properties/${encodeURIComponent(propertyId)}/photos/${encodeURIComponent(photoId)}/primary`, { method: "PUT" },
    ),
    reorderPropertyPhotos: (propertyId, photoIds) => request<{ readonly photos: readonly PropertyPhoto[] }>(
      `/v1/properties/${encodeURIComponent(propertyId)}/photos/order`, { method: "PUT", body: { photoIds } },
    ),
    deletePropertyPhoto: (propertyId, photoId) => request<void>(
      `/v1/properties/${encodeURIComponent(propertyId)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" },
    ),
    retrievePropertyPhotoStandard: () => request<PropertyPhotoStandard>("/v1/property-photo-standard"),
    updatePropertyPhotoStandard: (input) => request<PropertyPhotoStandard>("/v1/property-photo-standard", { method: "PUT", body: input }),
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
    listBuildings: (propertyId, cursor) => request<CompositionPage<PropertyBuilding>>(compositionPath(propertyId, undefined, cursor)),
    createBuilding: (propertyId, input) => request<PropertyBuilding>(compositionPath(propertyId), { method: "POST", body: input }),
    updateBuilding: (propertyId, buildingId, input) => request<PropertyBuilding>(compositionPath(propertyId, buildingId), { method: "PUT", body: input }),
    listUnits: (propertyId, buildingId, cursor) => request<CompositionPage<PropertyUnit>>(compositionPath(propertyId, buildingId, cursor, true)),
    createUnit: (propertyId, buildingId, input) => request<PropertyUnit>(compositionPath(propertyId, buildingId, undefined, true), { method: "POST", body: input }),
    updateUnitCode: (propertyId, buildingId, unitPropertyId, unitCode) => request<PropertyUnit>(`${compositionPath(propertyId, buildingId, undefined, true)}/${encodeURIComponent(unitPropertyId)}`, { method: "PUT", body: { unitCode } }),
    retrievePropertyWorkspace: (propertyId) => request<PropertyWorkspace>(
      `/v1/properties/${encodeURIComponent(propertyId)}/workspace`,
    ),
    listPropertyClients: (criteria = {}) => request<PropertyClientDirectoryPage>(clientDirectoryPath(criteria)),
    createPropertyClient: (input) => request<PropertyClient>("/v1/property-clients", { method: "POST", body: input }),
    retrievePropertyClient: (clientId) => request<PropertyClient>(`/v1/property-clients/${encodeURIComponent(clientId)}`),
    listPropertyContracts: (propertyId, cursor) => request<PropertyContractDirectoryPage>(
      contractPath(propertyId, undefined, cursor),
    ),
    createPropertyContract: (propertyId, input) => request<PropertyContract>(
      contractPath(propertyId), { method: "POST", body: input },
    ),
    retrievePropertyContract: (propertyId, contractId) => request<PropertyContract>(contractPath(propertyId, contractId)),
    updatePropertyContract: (propertyId, contractId, input) => request<PropertyContract>(
      contractPath(propertyId, contractId), { method: "PUT", body: input },
    ),
    activatePropertyContract: (propertyId, contractId) => request<PropertyContract>(
      `${contractPath(propertyId, contractId)}/activate`, { method: "POST" },
    ),
    endPropertyContract: (propertyId, contractId, endDate) => request<PropertyContract>(
      `${contractPath(propertyId, contractId)}/end`, { method: "POST", body: { endDate } },
    ),
    cancelPropertyContract: (propertyId, contractId) => request<PropertyContract>(
      `${contractPath(propertyId, contractId)}/cancel`, { method: "POST" },
    ),
  };
}

function contractPath(propertyId: string, contractId?: string, cursor?: string): `/v1/${string}` {
  const base = `/v1/properties/${encodeURIComponent(propertyId)}/contracts${contractId === undefined ? "" : `/${encodeURIComponent(contractId)}`}` as `/v1/${string}`;
  return cursor === undefined ? base : `${base}?limit=20&cursor=${encodeURIComponent(cursor)}`;
}

function clientDirectoryPath(criteria: Readonly<{ limit?: number; cursor?: string; search?: string }>): `/v1/${string}` {
  const query = new URLSearchParams();
  if (criteria.limit !== undefined) query.set("limit", String(criteria.limit));
  if (criteria.cursor !== undefined) query.set("cursor", criteria.cursor);
  if (criteria.search !== undefined) query.set("search", criteria.search);
  const encoded = query.toString();
  return encoded.length === 0 ? "/v1/property-clients" : `/v1/property-clients?${encoded}`;
}
function compositionPath(propertyId: string, buildingId?: string, cursor?: string, units = false): `/v1/${string}` {
  const base = `/v1/properties/${encodeURIComponent(propertyId)}/buildings${buildingId ? `/${encodeURIComponent(buildingId)}` : ""}${units ? "/units" : ""}` as `/v1/${string}`;
  return cursor ? `${base}?limit=20&cursor=${encodeURIComponent(cursor)}` : base;
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
