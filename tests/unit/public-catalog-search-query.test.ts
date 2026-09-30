import { describe, expect, it } from "vitest";

import { ListPublicPropertiesQuerySchema } from "../../apps/api/src/contracts/v1/public-properties/public-property.schema.js";
import { normalizePublicCatalogSearchQuery } from "../../apps/api/src/http/public-properties/public-catalog-search-query.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parse = (input: Record<string, unknown>) => normalizePublicCatalogSearchQuery(TENANT, ListPublicPropertiesQuerySchema.parse(input));

describe("PublicCatalogSearchQuery", () => {
  it("applies stable defaults", () => expect(parse({})).toEqual({ tenantId: TENANT, limit: 20, sort: "NEWEST" }));
  it("normalizes progressive geography", () => expect(parse({ countryCode: " ci ", city: " Abidjan ", commune: " Cocody ", quartier: " Riviera 3 " })).toMatchObject({ countryCode: "CI", city: "Abidjan", commune: "Cocody", quartier: "Riviera 3" }));
  it("rejects malformed country and currency codes", () => {
    expect(ListPublicPropertiesQuerySchema.safeParse({ countryCode: "CIV" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ minPriceAmountMinor: 1, currencyCode: "x" }).success).toBe(false);
  });
  it("deduplicates comma-separated property, structural and commercial values", () => expect(parse({ type: "HOUSE,HOUSE,APARTMENT", structuralRole: "UNIT,UNIT", transactionType: "SALE,LONG_TERM_RENTAL,SALE" })).toMatchObject({ propertyTypes: ["HOUSE", "APARTMENT"], structuralRoles: ["UNIT"], transactionTypes: ["SALE", "LONG_TERM_RENTAL"] }));
  it("rejects unsupported enum values", () => expect(ListPublicPropertiesQuerySchema.safeParse({ type: "VILLA" }).success).toBe(false));
  it("accepts price bounds only in one explicit normalized currency", () => expect(parse({ minPriceAmountMinor: "100", maxPriceAmountMinor: "500", currencyCode: " xof " })).toMatchObject({ minPriceAmountMinor: 100, maxPriceAmountMinor: 500, currencyCode: "XOF" }));
  it("rejects missing currency, negative and reversed price bounds", () => {
    expect(ListPublicPropertiesQuerySchema.safeParse({ minPriceAmountMinor: 1 }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ minPriceAmountMinor: -1, currencyCode: "XOF" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ minPriceAmountMinor: 2, maxPriceAmountMinor: 1, currencyCode: "XOF" }).success).toBe(false);
  });
  it("normalizes a valid UTC half-open availability interval to short-term rental", () => expect(parse({ availableFrom: "2026-11-01T14:00:00.000Z", availableTo: "2026-11-05T10:00:00.000Z" })).toMatchObject({ availableFrom: "2026-11-01T14:00:00.000Z", availableTo: "2026-11-05T10:00:00.000Z", transactionTypes: ["SHORT_TERM_RENTAL"] }));
  it("rejects missing, equal, reversed and mode-conflicting availability boundaries", () => {
    expect(ListPublicPropertiesQuerySchema.safeParse({ availableFrom: "2026-11-01T14:00:00.000Z" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ availableFrom: "2026-11-01T14:00:00.000Z", availableTo: "2026-11-01T14:00:00.000Z" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ availableFrom: "2026-11-05T10:00:00.000Z", availableTo: "2026-11-01T14:00:00.000Z" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ availableFrom: "2026-11-01T14:00:00.000Z", availableTo: "2026-11-05T10:00:00.000Z", transactionType: "LONG_TERM_RENTAL" }).success).toBe(false);
  });
  it("trims text and normalizes whitespace-only text away", () => {
    expect(parse({ q: "  Lagune Cocody  " })).toMatchObject({ q: "Lagune Cocody" });
    expect(parse({ q: "   " })).not.toHaveProperty("q");
  });
  it("enforces bedroom, sorting and page-size bounds", () => {
    expect(parse({ minBedrooms: "2", maxBedrooms: "4", sort: "PRICE_ASC", limit: "50" })).toMatchObject({ minBedrooms: 2, maxBedrooms: 4, sort: "PRICE_ASC", limit: 50 });
    expect(ListPublicPropertiesQuerySchema.safeParse({ minBedrooms: -1 }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ minBedrooms: 4, maxBedrooms: 2 }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ sort: "RANDOM" }).success).toBe(false);
    expect(ListPublicPropertiesQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
  it("normalizes a representative combined query without raw strings", () => expect(parse({ countryCode: "ci", city: "Abidjan", type: "APARTMENT", structuralRole: "UNIT", transactionType: "SHORT_TERM_RENTAL", minPriceAmountMinor: "10000", maxPriceAmountMinor: "50000", currencyCode: "xof", minBedrooms: "1", q: " piscine ", sort: "PRICE_DESC", limit: "10" })).toEqual({ tenantId: TENANT, limit: 10, sort: "PRICE_DESC", propertyTypes: ["APARTMENT"], structuralRoles: ["UNIT"], transactionTypes: ["SHORT_TERM_RENTAL"], countryCode: "CI", city: "Abidjan", minPriceAmountMinor: 10000, maxPriceAmountMinor: 50000, currencyCode: "XOF", minBedrooms: 1, q: "piscine" }));
});
