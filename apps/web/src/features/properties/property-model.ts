export const propertyTypes = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export type PropertyType = typeof propertyTypes[number];

export const transactionTypes = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
export type TransactionType = typeof transactionTypes[number];
export type PropertyStatus = "DRAFT";
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

export const propertyStatusLabels: Readonly<Record<PropertyStatus, string>> = { DRAFT: "Brouillon" };
export const pricingUnitLabels: Readonly<Record<PricingUnit | "MONTH", string>> = {
  MONTH: "Mensuel",
  NIGHT: "Nuit",
  WEEK: "Semaine",
};

export interface PropertyLocation {
  readonly country: string;
  readonly city: string;
  readonly district: string;
  readonly addressLine: string;
}

export interface PropertyDetails {
  readonly usableSurfaceSquareMeters?: number;
  readonly rooms?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly furnished?: boolean;
}

export type CommercialTerms =
  | Readonly<{ kind: "LONG_TERM_RENTAL"; currency: string; rentAmountMinor: number; rentPeriod: "MONTH"; securityDepositAmountMinor?: number; chargesAmountMinor?: number }>
  | Readonly<{ kind: "SHORT_TERM_RENTAL"; currency: string; rateAmountMinor: number; pricingUnit: PricingUnit }>
  | Readonly<{ kind: "SALE"; currency: string; salePriceAmountMinor: number }>;

export interface Property {
  readonly propertyId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly status: PropertyStatus;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly details?: PropertyDetails;
  readonly commercialTerms?: CommercialTerms;
}

export type PropertyPortfolioItem = Omit<Property, "details" | "commercialTerms">;

export interface PropertyPortfolioPage {
  readonly items: readonly PropertyPortfolioItem[];
  readonly pageInfo: Readonly<{
    readonly nextCursor: string | null;
    readonly hasNextPage: boolean;
  }>;
}

export interface PropertyPortfolioCriteria {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: PropertyStatus;
  readonly type?: PropertyType;
  readonly search?: string;
}

export interface CreatePropertyInput {
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly location: PropertyLocation;
}

export interface UpdatePropertyDetailsInput {
  readonly details: PropertyDetails;
  readonly commercialTerms: CommercialTerms;
}

export interface PropertyOwnership {
  readonly propertyId: string;
  readonly ownerId: string;
  readonly ownershipShare: number;
  readonly createdAt: string;
}

export type PropertyOwner =
  | Readonly<{ ownerType: "INDIVIDUAL"; ownerId: string; firstName: string; lastName: string; phoneNumber?: string; email?: string; createdAt: string; updatedAt: string }>
  | Readonly<{ ownerType: "LEGAL_ENTITY"; ownerId: string; legalName: string; registrationNumber?: string; phoneNumber?: string; email?: string; createdAt: string; updatedAt: string }>;

export function propertyOwnerName(owner: PropertyOwner): string {
  return owner.ownerType === "INDIVIDUAL" ? `${owner.firstName} ${owner.lastName}` : owner.legalName;
}

export function formatMinorAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount / 100);
}
