import type { ApartmentSubtype, PropertyLocation, PropertyStatus, PropertyStructuralRole, PropertyType, TransactionType } from "../domain/property.js";

export interface PropertyPortfolioCursor {
  readonly createdAt: string;
  readonly propertyId: string;
}

export interface PropertyPortfolioTypeCount {
  readonly propertyType: PropertyType;
  readonly totalCount: number;
}

export interface PropertyPortfolioAvailabilityTypeSummary {
  readonly propertyType: PropertyType;
  readonly totalCount: number;
  readonly configuredCount: number;
  readonly availableCount: number;
  readonly unavailableCount: number;
  readonly vacantCount: number;
  readonly occupiedCount: number;
}

export interface PropertyPortfolioContentSummary {
  readonly buildingCount: number;

  readonly composition: Readonly<{
    totalUnitCount: number;
    unitsByType: readonly PropertyPortfolioTypeCount[];
  }>;

  readonly availability: Readonly<{
    totalCount: number;
    configuredCount: number;
    availableCount: number;
    unavailableCount: number;
    vacantCount: number;
    occupiedCount: number;
    byType: readonly PropertyPortfolioAvailabilityTypeSummary[];
  }>;

  readonly contracts: Readonly<{
    totalCount: number;
    activeCount: number;
  }>;
}

export interface PropertyPortfolioItem {
  readonly propertyId: string;
  readonly parent?: Readonly<{ propertyId: string; title: string }>;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly status: PropertyStatus;
  readonly publishedAt?: string;
  readonly withdrawnAt?: string;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly featuredPhoto?: Readonly<{
    photoId: string;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    contentBase64: string;
  }>;
  readonly photoCount: number;
  readonly contentSummary?: PropertyPortfolioContentSummary;
  readonly owner?: Readonly<{
    ownerId: string;
    displayName: string;
    phoneNumber?: string;
    email?: string;
    additionalOwnerCount: number;
    inheritedFrom?: Readonly<{ propertyId: string; title: string }>;
  }>;
}

export interface PropertyPortfolioCriteria {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: PropertyPortfolioCursor;
  readonly status?: PropertyStatus;
  readonly propertyType?: PropertyType;
  readonly search?: string;
  readonly ownerId?: string;
}

export interface PropertyPortfolioPage {
  readonly items: readonly PropertyPortfolioItem[];
  readonly nextCursor?: PropertyPortfolioCursor;
}

export interface PropertyPortfolioQuery {
  list(criteria: PropertyPortfolioCriteria): Promise<PropertyPortfolioPage>;
}
