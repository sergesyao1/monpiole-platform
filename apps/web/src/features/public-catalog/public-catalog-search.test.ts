import { describe, expect, it } from "vitest";

import {
  parsePublicCatalogSearchParams,
  serializePublicCatalogQuery,
  serializePublicCatalogUrlState,
} from "./public-catalog-search.js";

describe("public catalog Web query model", () => {
  it("preserves the existing default API request", () => {
    expect(serializePublicCatalogQuery({}).toString()).toBe("limit=20");
    expect(parsePublicCatalogSearchParams(new URLSearchParams())).toEqual({});
  });

  it("serializes effective geography and safely encodes text", () => {
    const query = serializePublicCatalogQuery({
      countryCode: "CI", city: "Abidjan", commune: "Cocody", quartier: "Riviera 3",
      q: "villa & piscine",
    });
    expect(query.get("countryCode")).toBe("CI");
    expect(query.get("city")).toBe("Abidjan");
    expect(query.get("commune")).toBe("Cocody");
    expect(query.get("quartier")).toBe("Riviera 3");
    expect(query.get("q")).toBe("villa & piscine");
    expect(query.toString()).toContain("q=villa+%26+piscine");
  });

  it("serializes multi-value property, transaction and structural filters", () => {
    const query = serializePublicCatalogQuery({
      propertyTypes: ["APARTMENT", "HOUSE", "BUILDING"],
      transactionTypes: ["SHORT_TERM_RENTAL", "SALE"],
      structuralRoles: ["STANDALONE", "UNIT"],
    });
    expect(query.get("type")).toBe("APARTMENT,HOUSE,BUILDING");
    expect(query.get("transactionType")).toBe("SHORT_TERM_RENTAL,SALE");
    expect(query.get("structuralRole")).toBe("STANDALONE,UNIT");
  });

  it("preserves zero bounds, currency and bedroom bounds", () => {
    const query = serializePublicCatalogQuery({
      minPriceAmountMinor: 0, maxPriceAmountMinor: 500_000, currencyCode: "XOF",
      minBedrooms: 0, maxBedrooms: 4,
    });
    expect(Object.fromEntries(query)).toMatchObject({
      minPriceAmountMinor: "0", maxPriceAmountMinor: "500000", currencyCode: "XOF",
      minBedrooms: "0", maxBedrooms: "4",
    });
  });

  it("preserves availability instants without changing their value", () => {
    const availableFrom = "2026-11-01T14:00:00.000Z";
    const availableTo = "2026-11-05T10:00:00.000Z";
    const query = serializePublicCatalogQuery({ availableFrom, availableTo });
    expect(query.get("availableFrom")).toBe(availableFrom);
    expect(query.get("availableTo")).toBe(availableTo);
  });

  it.each(["NEWEST", "PRICE_ASC", "PRICE_DESC"] as const)("supports %s sorting", (sort) => {
    const query = serializePublicCatalogQuery({ sort });
    expect(query.get("sort")).toBe(sort === "NEWEST" ? null : sort);
    expect(parsePublicCatalogSearchParams(new URLSearchParams(`sort=${sort}`))).toEqual(
      sort === "NEWEST" ? {} : { sort },
    );
  });

  it("keeps cursor opaque and outside shareable URL state", () => {
    const cursor = "opaque+/cursor==";
    expect(serializePublicCatalogQuery({ cursor }).get("cursor")).toBe(cursor);
    expect(serializePublicCatalogUrlState({ q: "lagune" }).has("cursor")).toBe(false);
  });

  it("defensively ignores malformed URL values without throwing", () => {
    const params = new URLSearchParams("type=HOUSE,ALIEN&transactionType=EXCHANGE&structuralRole=UNIT,ROOT&countryCode=CIV&currencyCode=XO&minBedrooms=-1&maxBedrooms=101&minPriceAmountMinor=NaN&limit=0&sort=RANDOM&availableFrom=bad&availableTo=also-bad");
    expect(() => parsePublicCatalogSearchParams(params)).not.toThrow();
    expect(parsePublicCatalogSearchParams(params)).toEqual({ propertyTypes: ["HOUSE"], structuralRoles: ["UNIT"] });
  });

  it("omits blank values and empty arrays", () => {
    const query = serializePublicCatalogQuery({
      propertyTypes: [], transactionTypes: [], structuralRoles: [], city: " ", q: "", cursor: "",
    });
    expect(query.toString()).toBe("limit=20");
  });

  it("round trips canonical URL state", () => {
    const input = {
      propertyTypes: ["APARTMENT", "SHOP"] as const,
      transactionTypes: ["SHORT_TERM_RENTAL"] as const,
      structuralRoles: ["UNIT"] as const,
      countryCode: "CI", city: "Abidjan", commune: "Cocody", quartier: "Riviera",
      minPriceAmountMinor: 0, maxPriceAmountMinor: 100_000, currencyCode: "XOF",
      minBedrooms: 1, maxBedrooms: 3,
      availableFrom: "2026-11-01T14:00:00.000Z", availableTo: "2026-11-05T10:00:00.000Z",
      q: "piscine", sort: "PRICE_ASC" as const,
    };
    expect(parsePublicCatalogSearchParams(serializePublicCatalogUrlState(input))).toEqual(input);
  });
});
