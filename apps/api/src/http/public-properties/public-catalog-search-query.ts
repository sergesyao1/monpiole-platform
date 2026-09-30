import type { ListPublicPropertiesQuery, PublicCatalogSort, PublicPropertyCatalogCursor } from "@monpiole/property-management";

import type { ListPublicPropertiesQuery as HttpPublicCatalogSearchQuery } from "../../contracts/v1/public-properties/public-property.schema.js";
import { TransportValidationException } from "../errors/transport-validation.exception.js";
import { decodePublicPropertyCatalogCursor } from "./public-property-cursor.js";

export type NormalizedPublicCatalogSearchQuery = ListPublicPropertiesQuery & Readonly<{
  tenantId: string;
  limit: number;
  sort: PublicCatalogSort;
}>;

export function normalizePublicCatalogSearchQuery(
  tenantId: string,
  query: HttpPublicCatalogSearchQuery,
): NormalizedPublicCatalogSearchQuery {
  const cursor: PublicPropertyCatalogCursor | undefined = decodePublicPropertyCatalogCursor(query.cursor);
  if (cursor?.sort !== undefined && cursor.sort !== query.sort) {
    throw new TransportValidationException([{ path: "query.cursor", code: "invalid" }]);
  }
  const transactionTypes = query.availableFrom === undefined
    ? query.transactionType
    : (query.transactionType ?? ["SHORT_TERM_RENTAL"] as const);
  return {
    tenantId,
    limit: query.limit,
    sort: query.sort,
    ...(cursor === undefined ? {} : { cursor }),
    ...(query.type === undefined ? {} : { propertyTypes: query.type }),
    ...(transactionTypes === undefined ? {} : { transactionTypes }),
    ...(query.structuralRole === undefined ? {} : { structuralRoles: query.structuralRole }),
    ...(query.countryCode === undefined ? {} : { countryCode: query.countryCode }),
    ...(query.city === undefined ? {} : { city: query.city }),
    ...(query.commune === undefined ? {} : { commune: query.commune }),
    ...(query.quartier === undefined ? {} : { quartier: query.quartier }),
    ...(query.minPriceAmountMinor === undefined ? {} : { minPriceAmountMinor: query.minPriceAmountMinor }),
    ...(query.maxPriceAmountMinor === undefined ? {} : { maxPriceAmountMinor: query.maxPriceAmountMinor }),
    ...(query.currencyCode === undefined ? {} : { currencyCode: query.currencyCode }),
    ...(query.minBedrooms === undefined ? {} : { minBedrooms: query.minBedrooms }),
    ...(query.maxBedrooms === undefined ? {} : { maxBedrooms: query.maxBedrooms }),
    ...(query.availableFrom === undefined ? {} : { availableFrom: query.availableFrom }),
    ...(query.availableTo === undefined ? {} : { availableTo: query.availableTo }),
    ...(query.q === undefined ? {} : { q: query.q }),
  };
}
