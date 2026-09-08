import type {
  ApartmentSubtype,
  PropertyStructuralRole,
  PropertyType,
  TransactionType,
} from "../domain/property.js";
import type { PropertyPhotoCategory } from "../domain/property-photo.js";

export interface PublicPropertyCatalogCursor {
  readonly publishedAt: string;
  readonly publicPropertyId: string;
}

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
    kind: "LONG_TERM_RENTAL";
    currency: string;
    rentAmountMinor: number;
    rentPeriod: "MONTH";
    securityDepositAmountMinor?: number;
    chargesAmountMinor?: number;
    agencyFeeAmountMinor?: number;
  }>
  | Readonly<{
    kind: "SHORT_TERM_RENTAL";
    currency: string;
    rateAmountMinor: number;
    pricingUnit: "NIGHT" | "WEEK";
    cleaningFeeAmountMinor?: number;
    securityDepositAmountMinor?: number;
    minimumStayNights?: number;
  }>
  | Readonly<{
    kind: "SALE";
    currency: string;
    salePriceAmountMinor: number;
    agencyFeeAmountMinor?: number;
  }>;

export interface PublicPropertyPrimaryPhotoReference {
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface PublicPropertyMediaReference {
  readonly mediaId: string;
  readonly kind: "IMAGE";
  readonly category: PropertyPhotoCategory;
  readonly position: number;
  readonly isPrimary: boolean;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface PublicPropertyCatalogItem {
  readonly publicPropertyId: string;
  readonly title: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PublicPropertyLocation;
  readonly commercialTerms: PublicPropertyCommercialTerms;
  readonly primaryPhoto: PublicPropertyPrimaryPhotoReference | null;
  readonly publishedAt: string;
}

export interface PublicPropertyCatalogDetail extends PublicPropertyCatalogItem {
  readonly description: string | null;
  readonly details: PublicPropertyDetails;
  readonly gallery: readonly PublicPropertyMediaReference[];
}

export interface PublicPropertyCatalogCriteria {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: PublicPropertyCatalogCursor;
  readonly propertyType?: PropertyType;
  readonly transactionType?: TransactionType;
}

export interface PublicPropertyCatalogPage {
  readonly items: readonly PublicPropertyCatalogItem[];
  readonly nextCursor?: PublicPropertyCatalogCursor;
}

export interface PublicPrimaryPhotoContent {
  readonly content: Uint8Array;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly contentByteSize: number;
  readonly contentSha256: string;
}
export type PublicPropertyMediaContent = PublicPrimaryPhotoContent;

export interface PublicPropertyCatalogQuery {
  list(criteria: PublicPropertyCatalogCriteria): Promise<PublicPropertyCatalogPage>;
  retrieve(tenantId: string, publicPropertyId: string): Promise<PublicPropertyCatalogDetail | undefined>;
  retrievePrimaryPhoto(tenantId: string, publicPropertyId: string): Promise<PublicPrimaryPhotoContent | undefined>;
  retrieveMedia(tenantId: string, publicPropertyId: string, mediaId: string): Promise<PublicPropertyMediaContent | undefined>;
}
