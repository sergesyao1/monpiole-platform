import { PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyStatus, type PropertyType } from "../domain/property.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyPortfolioCursor, PropertyPortfolioPage, PropertyPortfolioQuery } from "./property-portfolio-query.js";

export const DEFAULT_PROPERTY_PORTFOLIO_LIMIT = 20;
export const MAX_PROPERTY_PORTFOLIO_LIMIT = 100;
export const MAX_PROPERTY_PORTFOLIO_SEARCH_LENGTH = 100;

export interface ListPropertiesQuery {
  readonly authority: PropertyAuthority;
  readonly limit?: number;
  readonly cursor?: PropertyPortfolioCursor;
  readonly status?: PropertyStatus;
  readonly propertyType?: PropertyType;
  readonly search?: string;
  readonly ownerId?: string;
}

export class InvalidPropertyPortfolioQueryError extends Error {
  readonly code = "INVALID_PROPERTY_PORTFOLIO_QUERY";
  constructor(readonly field: "limit" | "cursor" | "status" | "type" | "search" | "ownerId") {
    super(`Invalid Property portfolio query ${field}`);
  }
}

export class ListProperties {
  constructor(private readonly portfolio: PropertyPortfolioQuery) {}

  async execute(query: ListPropertiesQuery): Promise<PropertyPortfolioPage> {
    const tenantId = authorizedTenant(query.authority, "LIST_PROPERTIES");
    const limit = query.limit ?? DEFAULT_PROPERTY_PORTFOLIO_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROPERTY_PORTFOLIO_LIMIT) {
      throw new InvalidPropertyPortfolioQueryError("limit");
    }
    if (query.status !== undefined && !PROPERTY_STATUSES.includes(query.status)) throw new InvalidPropertyPortfolioQueryError("status");
    if (query.propertyType !== undefined && !PROPERTY_TYPES.includes(query.propertyType)) {
      throw new InvalidPropertyPortfolioQueryError("type");
    }
    const search = query.search?.trim();
    if (search !== undefined && (search.length === 0 || search.length > MAX_PROPERTY_PORTFOLIO_SEARCH_LENGTH)) {
      throw new InvalidPropertyPortfolioQueryError("search");
    }
    if (query.ownerId !== undefined && !isUuid(query.ownerId)) throw new InvalidPropertyPortfolioQueryError("ownerId");
    return this.portfolio.list({
      tenantId, limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.propertyType === undefined ? {} : { propertyType: query.propertyType }),
      ...(search === undefined ? {} : { search }),
      ...(query.ownerId === undefined ? {} : { ownerId: query.ownerId }),
    });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
