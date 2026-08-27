import type { PropertyLocation, PropertyStatus, PropertyType, TransactionType } from "../domain/property.js";

export interface PropertyPortfolioCursor {
  readonly createdAt: string;
  readonly propertyId: string;
}

export interface PropertyPortfolioItem {
  readonly propertyId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly status: PropertyStatus;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PropertyPortfolioCriteria {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: PropertyPortfolioCursor;
  readonly status?: PropertyStatus;
  readonly propertyType?: PropertyType;
  readonly search?: string;
}

export interface PropertyPortfolioPage {
  readonly items: readonly PropertyPortfolioItem[];
  readonly nextCursor?: PropertyPortfolioCursor;
}

export interface PropertyPortfolioQuery {
  list(criteria: PropertyPortfolioCriteria): Promise<PropertyPortfolioPage>;
}
