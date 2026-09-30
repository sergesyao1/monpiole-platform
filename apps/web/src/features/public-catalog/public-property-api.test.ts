import { afterEach, describe, expect, it, vi } from "vitest";

import { createPublicPropertyApi } from "./public-property-api.js";

describe("public Property API search client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the complete canonical query without authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [], pageInfo: { nextCursor: null, hasNextPage: false },
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await createPublicPropertyApi().list({
      propertyTypes: ["OFFICE", "SHOP"], transactionTypes: ["SALE"], structuralRoles: ["STANDALONE"],
      countryCode: "CI", city: "Abidjan", commune: "Cocody", quartier: "Riviera",
      minPriceAmountMinor: 0, maxPriceAmountMinor: 10_000_000, currencyCode: "XOF",
      minBedrooms: 0, maxBedrooms: 2, q: "bureau & vue", sort: "PRICE_ASC", limit: 50,
      cursor: "opaque+/cursor==",
    });
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input), "https://catalogue.test");
    expect(url.pathname).toBe("/v1/public/properties");
    expect(url.searchParams.get("type")).toBe("OFFICE,SHOP");
    expect(url.searchParams.get("cursor")).toBe("opaque+/cursor==");
    expect(url.searchParams.get("q")).toBe("bureau & vue");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("keeps the historical no-filter request stable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [], pageInfo: { nextCursor: null, hasNextPage: false },
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await createPublicPropertyApi().list();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/v1/public/properties?limit=20");
  });

  it("loads only active canonical currency metadata from the public reference API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { code: "XOF", nameKey: "currency.xof", minorUnit: 0, active: true },
      { code: "USD", nameKey: "currency.usd", minorUnit: 2, active: true },
      { code: "BAD", nameKey: "currency.bad", minorUnit: 10, active: true },
      { code: "EUR", nameKey: "currency.eur", minorUnit: 2, active: false },
    ] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createPublicPropertyApi().listCurrencies()).resolves.toEqual([
      { code: "XOF", nameKey: "currency.xof", minorUnit: 0, active: true },
      { code: "USD", nameKey: "currency.usd", minorUnit: 2, active: true },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/v1/reference/currencies");
  });
});
