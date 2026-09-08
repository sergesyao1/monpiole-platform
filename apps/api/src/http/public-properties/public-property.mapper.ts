import type { PublicPropertyCatalogDetail, PublicPropertyCatalogItem } from "@monpiole/property-management";

import type {
  PublicPropertyDetail,
  PublicPropertySummary,
} from "../../contracts/v1/public-properties/public-property.schema.js";

export function toPublicPropertySummary(item: PublicPropertyCatalogItem): PublicPropertySummary {
  return {
    publicPropertyId: item.publicPropertyId,
    title: item.title,
    propertyType: item.propertyType,
    transactionType: item.transactionType,
    ...(item.apartmentSubtype === undefined ? {} : { apartmentSubtype: item.apartmentSubtype }),
    structuralRole: item.structuralRole,
    location: { country: item.location.country, city: item.location.city, district: item.location.district },
    commercialTerms: item.commercialTerms,
    primaryPhoto: item.primaryPhoto === null
      ? null
      : {
        url: `/v1/public/properties/${item.publicPropertyId}/primary-photo`,
        contentType: item.primaryPhoto.contentType,
      },
    publishedAt: item.publishedAt,
  };
}

export function toPublicPropertyDetail(item: PublicPropertyCatalogDetail): PublicPropertyDetail {
  return {
    ...toPublicPropertySummary(item),
    description: item.description,
    details: {
      ...(item.details.usableSurfaceSquareMeters === undefined
        ? {}
        : { usableSurfaceSquareMeters: item.details.usableSurfaceSquareMeters }),
      ...(item.details.rooms === undefined ? {} : { rooms: item.details.rooms }),
      ...(item.details.bedrooms === undefined ? {} : { bedrooms: item.details.bedrooms }),
      ...(item.details.bathrooms === undefined ? {} : { bathrooms: item.details.bathrooms }),
      ...(item.details.furnished === undefined ? {} : { furnished: item.details.furnished }),
    },
    gallery: item.gallery.map((media) => ({
      ...media,
      url: `/v1/public/properties/${item.publicPropertyId}/media/${media.mediaId}/content`,
    })),
  };
}
