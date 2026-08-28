import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type {
  PropertyOwnerDirectoryCursor, PropertyOwnerDirectoryPage, PropertyOwnerDirectoryQuery,
} from "./property-owner-directory-query.js";

export const DEFAULT_PROPERTY_OWNER_DIRECTORY_LIMIT = 20;
export const MAX_PROPERTY_OWNER_DIRECTORY_LIMIT = 100;
export const MAX_PROPERTY_OWNER_DIRECTORY_SEARCH_LENGTH = 100;

export interface ListPropertyOwnersQuery {
  readonly authority: PropertyAuthority;
  readonly limit?: number;
  readonly cursor?: PropertyOwnerDirectoryCursor;
  readonly search?: string;
}

export class InvalidPropertyOwnerDirectoryQueryError extends Error {
  readonly code = "INVALID_PROPERTY_OWNER_DIRECTORY_QUERY";
  constructor(readonly field: "limit" | "cursor" | "search") {
    super(`Invalid Property owner directory query ${field}`);
  }
}

export class ListPropertyOwners {
  constructor(private readonly directory: PropertyOwnerDirectoryQuery) {}

  async execute(query: ListPropertyOwnersQuery): Promise<PropertyOwnerDirectoryPage> {
    const tenantId = authorizedTenant(query.authority, "LIST_PROPERTY_OWNERS");
    const limit = query.limit ?? DEFAULT_PROPERTY_OWNER_DIRECTORY_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROPERTY_OWNER_DIRECTORY_LIMIT) {
      throw new InvalidPropertyOwnerDirectoryQueryError("limit");
    }
    const search = query.search?.trim();
    if (search !== undefined && (search.length === 0 || search.length > MAX_PROPERTY_OWNER_DIRECTORY_SEARCH_LENGTH)) {
      throw new InvalidPropertyOwnerDirectoryQueryError("search");
    }
    return this.directory.list({
      tenantId, limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(search === undefined ? {} : { search }),
    });
  }
}
