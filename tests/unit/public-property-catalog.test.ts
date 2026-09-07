import { describe, expect, it, vi } from "vitest";

import {
  InvalidPublicPropertyCatalogQueryError,
  ListPublicProperties,
  PublicPropertyNotFoundError,
  RetrievePublicPrimaryPhoto,
  RetrievePublicProperty,
  type PublicPropertyCatalogDetail,
  type PublicPropertyCatalogQuery,
} from "../../services/property-management/src/index.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PUBLISHED_AT = "2026-08-31T10:00:00.000Z";

function detail(): PublicPropertyCatalogDetail {
  return {
    publicPropertyId: PROPERTY_ID,
    title: "Maison des Lagunes",
    description: "Vue sur la lagune",
    propertyType: "HOUSE",
    transactionType: "SALE",
    structuralRole: "STANDALONE",
    location: { country: "CI", city: "Abidjan", district: "Cocody" },
    details: { rooms: 5, bedrooms: 3 },
    commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 },
    primaryPhoto: { contentType: "image/webp" },
    publishedAt: PUBLISHED_AT,
  };
}

function query(overrides: Partial<PublicPropertyCatalogQuery> = {}): PublicPropertyCatalogQuery {
  return {
    list: vi.fn(async () => ({ items: [detail()] })),
    retrieve: vi.fn(async () => detail()),
    retrievePrimaryPhoto: vi.fn(async () => ({
      content: new Uint8Array([1, 2, 3]),
      contentType: "image/webp" as const,
      contentByteSize: 3,
      contentSha256: "a".repeat(64),
    })),
    ...overrides,
  };
}

describe("public Property catalog application", () => {
  it("passes one explicit tenant, PUBLISHED ordering cursor and only the approved filters", async () => {
    const catalog = query();
    const useCase = new ListPublicProperties(catalog);
    await useCase.execute({
      tenantId: TENANT_ID,
      limit: 50,
      cursor: { publishedAt: PUBLISHED_AT, publicPropertyId: PROPERTY_ID },
      propertyType: "HOUSE",
      transactionType: "SALE",
    });
    expect(catalog.list).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      limit: 50,
      cursor: { publishedAt: PUBLISHED_AT, publicPropertyId: PROPERTY_ID },
      propertyType: "HOUSE",
      transactionType: "SALE",
    });
  });

  it("defaults to 20 and rejects unbounded or unsupported list input", async () => {
    const catalog = query();
    const useCase = new ListPublicProperties(catalog);
    await useCase.execute({ tenantId: TENANT_ID });
    expect(catalog.list).toHaveBeenCalledWith({ tenantId: TENANT_ID, limit: 20 });
    for (const invalid of [
      { tenantId: TENANT_ID, limit: 0 },
      { tenantId: TENANT_ID, limit: 51 },
      { tenantId: TENANT_ID, propertyType: "CASTLE" },
      { tenantId: TENANT_ID, transactionType: "EXCHANGE" },
      { tenantId: TENANT_ID, cursor: { publishedAt: "yesterday", publicPropertyId: PROPERTY_ID } },
    ]) {
      await expect(useCase.execute(invalid as never)).rejects.toBeInstanceOf(InvalidPublicPropertyCatalogQueryError);
    }
  });

  it("retrieves a detail through the dedicated public port", async () => {
    const catalog = query();
    await expect(new RetrievePublicProperty(catalog).execute({ tenantId: TENANT_ID, publicPropertyId: PROPERTY_ID }))
      .resolves.toEqual(detail());
    expect(catalog.retrieve).toHaveBeenCalledWith(TENANT_ID, PROPERTY_ID);
  });

  it("uses the same not-found result for any non-public detail", async () => {
    const catalog = query({ retrieve: vi.fn(async () => undefined) });
    await expect(new RetrievePublicProperty(catalog).execute({ tenantId: TENANT_ID, publicPropertyId: PROPERTY_ID }))
      .rejects.toBeInstanceOf(PublicPropertyNotFoundError);
  });

  it("validates public identifiers before querying persistence", async () => {
    const catalog = query();
    await expect(new RetrievePublicProperty(catalog).execute({ tenantId: TENANT_ID, publicPropertyId: "not-an-id" }))
      .rejects.toMatchObject({ code: "INVALID_PUBLIC_PROPERTY_CATALOG_QUERY", field: "publicPropertyId" });
    expect(catalog.retrieve).not.toHaveBeenCalled();
  });

  it("retrieves only the public primary-photo projection and hides absence as not-found", async () => {
    const available = query();
    await expect(new RetrievePublicPrimaryPhoto(available).execute({ tenantId: TENANT_ID, publicPropertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ contentType: "image/webp", contentByteSize: 3 });
    const absent = query({ retrievePrimaryPhoto: vi.fn(async () => undefined) });
    await expect(new RetrievePublicPrimaryPhoto(absent).execute({ tenantId: TENANT_ID, publicPropertyId: PROPERTY_ID }))
      .rejects.toBeInstanceOf(PublicPropertyNotFoundError);
  });
});
