import { PROPERTY_TYPES, TRANSACTION_TYPES, type PropertyType, type TransactionType } from "../domain/property.js";
import type {
  PublicPropertyCatalogCursor,
  PublicPropertyCatalogDetail,
  PublicPropertyCatalogPage,
  PublicPropertyCatalogQuery,
  PublicPrimaryPhotoContent,
} from "./public-property-catalog-query.js";

export const DEFAULT_PUBLIC_PROPERTY_CATALOG_LIMIT = 20;
export const MAX_PUBLIC_PROPERTY_CATALOG_LIMIT = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ListPublicPropertiesQuery {
  readonly tenantId: string;
  readonly limit?: number;
  readonly cursor?: PublicPropertyCatalogCursor;
  readonly propertyType?: PropertyType;
  readonly transactionType?: TransactionType;
}

export interface RetrievePublicPropertyQuery {
  readonly tenantId: string;
  readonly publicPropertyId: string;
}

export class InvalidPublicPropertyCatalogQueryError extends Error {
  readonly code = "INVALID_PUBLIC_PROPERTY_CATALOG_QUERY";

  constructor(readonly field: "tenant" | "limit" | "cursor" | "type" | "transactionType" | "publicPropertyId") {
    super(`Invalid public Property catalog query ${field}`);
  }
}

export class PublicPropertyNotFoundError extends Error {
  readonly code = "PUBLIC_PROPERTY_NOT_FOUND";

  constructor() {
    super("Public Property not found");
  }
}

export class ListPublicProperties {
  constructor(private readonly catalog: PublicPropertyCatalogQuery) {}

  async execute(query: ListPublicPropertiesQuery): Promise<PublicPropertyCatalogPage> {
    assertTenant(query.tenantId);
    const limit = query.limit ?? DEFAULT_PUBLIC_PROPERTY_CATALOG_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PUBLIC_PROPERTY_CATALOG_LIMIT) {
      throw new InvalidPublicPropertyCatalogQueryError("limit");
    }
    if (query.propertyType !== undefined && !PROPERTY_TYPES.includes(query.propertyType)) {
      throw new InvalidPublicPropertyCatalogQueryError("type");
    }
    if (query.transactionType !== undefined && !TRANSACTION_TYPES.includes(query.transactionType)) {
      throw new InvalidPublicPropertyCatalogQueryError("transactionType");
    }
    if (query.cursor !== undefined) assertCursor(query.cursor);

    return this.catalog.list({
      tenantId: query.tenantId,
      limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.propertyType === undefined ? {} : { propertyType: query.propertyType }),
      ...(query.transactionType === undefined ? {} : { transactionType: query.transactionType }),
    });
  }
}

export class RetrievePublicProperty {
  constructor(private readonly catalog: PublicPropertyCatalogQuery) {}

  async execute(query: RetrievePublicPropertyQuery): Promise<PublicPropertyCatalogDetail> {
    assertIdentifiers(query);
    const property = await this.catalog.retrieve(query.tenantId, query.publicPropertyId);
    if (property === undefined) throw new PublicPropertyNotFoundError();
    return property;
  }
}

export class RetrievePublicPrimaryPhoto {
  constructor(private readonly catalog: PublicPropertyCatalogQuery) {}

  async execute(query: RetrievePublicPropertyQuery): Promise<PublicPrimaryPhotoContent> {
    assertIdentifiers(query);
    const photo = await this.catalog.retrievePrimaryPhoto(query.tenantId, query.publicPropertyId);
    if (photo === undefined) throw new PublicPropertyNotFoundError();
    return photo;
  }
}

function assertIdentifiers(query: RetrievePublicPropertyQuery): void {
  assertTenant(query.tenantId);
  if (!UUID.test(query.publicPropertyId)) {
    throw new InvalidPublicPropertyCatalogQueryError("publicPropertyId");
  }
}

function assertTenant(tenantId: string): void {
  if (!UUID.test(tenantId)) throw new InvalidPublicPropertyCatalogQueryError("tenant");
}

function assertCursor(cursor: PublicPropertyCatalogCursor): void {
  if (!UUID.test(cursor.publicPropertyId) || !isCanonicalIsoDate(cursor.publishedAt)) {
    throw new InvalidPublicPropertyCatalogQueryError("cursor");
  }
}

function isCanonicalIsoDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}
