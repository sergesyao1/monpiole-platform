export type PropertyType = "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER";
export type TransactionType = "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL" | "SALE";
export type ApartmentSubtype = "STUDIO" | "MULTI_ROOM";
export type PropertyStructuralRole = "STANDALONE" | "COMPOSITE" | "UNIT";
export type PricingUnit = "NIGHT" | "WEEK";

export const propertyTypeLabels: Readonly<Record<PropertyType, string>> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  LAND: "Terrain",
  COMMERCIAL: "Local commercial",
  OTHER: "Autre",
};
export const transactionTypeLabels: Readonly<Record<TransactionType, string>> = {
  LONG_TERM_RENTAL: "Location longue durée",
  SHORT_TERM_RENTAL: "Location courte durée",
  SALE: "Vente",
};
export const propertyStructuralRoleLabels: Readonly<Record<PropertyStructuralRole, string>> = {
  STANDALONE: "Bien autonome",
  COMPOSITE: "Ensemble immobilier",
  UNIT: "Unité",
};
const pricingUnitLabels: Readonly<Record<PricingUnit, string>> = { NIGHT: "Nuit", WEEK: "Semaine" };

export interface PublicPropertyLocation {
  readonly country: string;
  readonly city: string;
  readonly district: string;
}

export interface PublicPropertyDetails {
  readonly usableSurfaceSquareMeters?: number;
  readonly rooms?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly furnished?: boolean;
}

export type PublicPropertyCommercialTerms =
  | Readonly<{
    kind: "LONG_TERM_RENTAL"; currency: string; rentAmountMinor: number; rentPeriod: "MONTH";
    securityDepositAmountMinor?: number; chargesAmountMinor?: number; agencyFeeAmountMinor?: number;
  }>
  | Readonly<{
    kind: "SHORT_TERM_RENTAL"; currency: string; rateAmountMinor: number; pricingUnit: PricingUnit;
    cleaningFeeAmountMinor?: number; securityDepositAmountMinor?: number; minimumStayNights?: number;
  }>
  | Readonly<{
    kind: "SALE"; currency: string; salePriceAmountMinor: number; agencyFeeAmountMinor?: number;
  }>;

export interface PublicPropertyPrimaryPhoto {
  readonly url: `/v1/public/properties/${string}/primary-photo`;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface PublicPropertyMedia {
  readonly mediaId: string;
  readonly kind: "IMAGE";
  readonly category: string;
  readonly position: number;
  readonly isPrimary: boolean;
  readonly url: `/v1/public/properties/${string}/media/${string}/content`;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface PublicPropertySummary {
  readonly publicPropertyId: string;
  readonly title: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PublicPropertyLocation;
  readonly commercialTerms: PublicPropertyCommercialTerms;
  readonly primaryPhoto: PublicPropertyPrimaryPhoto | null;
  readonly publishedAt: string;
}

export interface PublicPropertyDetail extends PublicPropertySummary {
  readonly description: string | null;
  readonly details: PublicPropertyDetails;
  readonly gallery: readonly PublicPropertyMedia[];
  readonly amenities: readonly { readonly code: string; readonly category: string; readonly labelFr: string; readonly displayOrder: number }[];
}

export interface PublicPropertyCatalogPage {
  readonly items: readonly PublicPropertySummary[];
  readonly pageInfo: Readonly<{ readonly nextCursor: string | null; readonly hasNextPage: boolean }>;
}

export interface PublicPropertyCatalogCriteria {
  readonly cursor?: string;
  readonly type?: PropertyType;
  readonly transactionType?: TransactionType;
}

export function formatPublicPropertyPrice(terms: PublicPropertyCommercialTerms): string {
  if (terms.kind === "SALE") return formatPublicMinorAmount(terms.salePriceAmountMinor, terms.currency);
  if (terms.kind === "LONG_TERM_RENTAL") {
    return `${formatPublicMinorAmount(terms.rentAmountMinor, terms.currency)} / mois`;
  }
  return `${formatPublicMinorAmount(terms.rateAmountMinor, terms.currency)} / ${pricingUnitLabels[terms.pricingUnit].toLowerCase()}`;
}

export function formatPublicMinorAmount(amount: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  const formatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount / (10 ** digits));
  return currency === "XOF" ? formatted.replace(/F\s*CFA/u, "FCFA") : formatted;
}

function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
