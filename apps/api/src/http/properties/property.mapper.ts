import type { CreatePropertyCommand, PropertyAuthority, PropertyView, PublishPropertyCommand, SetPropertyPricingCommand, UpdatePropertyCoreInformationCommand, UpdatePropertyDetailsCommand, WithdrawPropertyFromCatalogCommand } from "@monpiole/property-management";
import type { CreatePropertyRequest, PropertyPhoto, PropertyPhotoGalleryResponse, PropertyResponse, SetPropertyPricingRequest, UpdatePropertyCoreInformationRequest, UpdatePropertyDetailsRequest } from "../../contracts/v1/properties/property.schema.js";
import type { PropertyPhotoValues } from "@monpiole/property-management";

export function toCreatePropertyCommand(request: CreatePropertyRequest, correlationId: string, authority: PropertyAuthority): CreatePropertyCommand {
  return { ...request, correlationId, authority };
}
export function toPropertyResponse(property: PropertyView, authority: PropertyAuthority): PropertyResponse {
  const photos = (property.photos ?? []).map(toPropertyPhotoResponse);
  const primaryPhoto = photos.find((photo) => photo.isPrimary);
  const base = {
    propertyId: property.propertyId, title: property.title,
    ...(property.description === undefined ? {} : { description: property.description }),
    propertyType: property.propertyType, transactionType: property.transactionType,
    ...(property.commercializationMode === undefined ? {} : { commercializationMode: property.commercializationMode }),
    ...(property.apartmentSubtype === undefined ? {} : { apartmentSubtype: property.apartmentSubtype }),
    location: property.location,
    structuralRole: property.structuralRole,
    createdAt: property.createdAt, updatedAt: property.updatedAt,
    ...(property.details === undefined ? {} : { details: property.details }),
    ...(property.commercialTerms === undefined ? {} : { commercialTerms: property.commercialTerms }),
    photos,
    ...(primaryPhoto === undefined ? {} : { primaryPhoto }),
  };
  if (property.status === "PUBLISHED") {
    if (property.publishedAt === undefined) throw new Error("Published property is missing its publication instant");
    const canWithdrawFromCatalog = authority.grants.includes("WITHDRAW_PROPERTY_FROM_CATALOG")
      && authority.tenantIds.length === 1 && authority.tenantIds[0] === property.tenantId;
    return { ...base, status: "PUBLISHED", publishedAt: property.publishedAt, canWithdrawFromCatalog };
  }
  if (property.status === "WITHDRAWN") {
    if (property.publishedAt === undefined || property.withdrawnAt === undefined) {
      throw new Error("Withdrawn property is missing lifecycle instants");
    }
    return { ...base, status: "WITHDRAWN", publishedAt: property.publishedAt, withdrawnAt: property.withdrawnAt, canWithdrawFromCatalog: false };
  }
  return { ...base, status: "DRAFT", canWithdrawFromCatalog: false };
}

export function toPropertyPhotoResponse(photo: PropertyPhotoValues): PropertyPhoto {
  return {
    photoId: photo.photoId, mediaKind: photo.mediaKind, position: photo.position,
    category: photo.category, status: photo.status,
    contentPath: `/v1/properties/${photo.propertyId}/photos/${photo.photoId}/content`,
    contentType: photo.contentType, contentByteSize: photo.contentByteSize, contentSha256: photo.contentSha256,
    isPrimary: photo.isPrimary, registeredAt: photo.registeredAt, availableAt: photo.availableAt,
  };
}

export function toPropertyPhotoGalleryResponse(photos: readonly PropertyPhotoValues[]): PropertyPhotoGalleryResponse {
  return { photos: photos.map(toPropertyPhotoResponse) };
}

export function toUpdatePropertyDetailsCommand(
  propertyId: string,
  request: UpdatePropertyDetailsRequest,
  correlationId: string,
  authority: PropertyAuthority,
): UpdatePropertyDetailsCommand {
  return { propertyId, ...request, correlationId, authority };
}

export function toSetPropertyPricingCommand(
  propertyId: string,
  pricing: SetPropertyPricingRequest,
  correlationId: string,
  authority: PropertyAuthority,
): SetPropertyPricingCommand {
  return { propertyId, pricing, correlationId, authority };
}

export function toUpdatePropertyCoreInformationCommand(
  propertyId: string,
  request: UpdatePropertyCoreInformationRequest,
  correlationId: string,
  authority: PropertyAuthority,
): UpdatePropertyCoreInformationCommand {
  return { propertyId, ...request, correlationId, authority };
}

export function toPublishPropertyCommand(
  propertyId: string,
  correlationId: string,
  authority: PropertyAuthority,
): PublishPropertyCommand {
  return { propertyId, correlationId, authority };
}

export function toWithdrawPropertyFromCatalogCommand(
  propertyId: string,
  correlationId: string,
  authority: PropertyAuthority,
): WithdrawPropertyFromCatalogCommand {
  return { propertyId, correlationId, authority };
}
