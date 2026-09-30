import { describe, expect, it, vi } from "vitest";

import {
  ListRentablePublicProperties,
  RetrievePublicRentalAvailability,
} from "../../apps/api/src/operations/rental-availability.js";
import { PublicPropertyNotFoundError, type PublicPropertyCatalogItem } from "../../services/property-management/src/index.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const LONG_TERM = "22222222-2222-4222-8222-222222222222";
const SHORT_TERM = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-09-27T12:00:00.000Z";

function item(publicPropertyId: string, transactionType: "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL"): PublicPropertyCatalogItem {
  return {
    publicPropertyId,
    title: "Bien publié",
    propertyType: "HOUSE",
    transactionType,
    structuralRole: "STANDALONE",
    location: { country: "CI", city: "Abidjan", district: "Cocody" },
    publicLocation: null,
    commercialTerms: transactionType === "LONG_TERM_RENTAL"
      ? { kind: transactionType, currency: "XOF", rentAmountMinor: 500_000, rentPeriod: "MONTH" }
      : { kind: transactionType, currency: "XOF", rateAmountMinor: 50_000, pricingUnit: "NIGHT" },
    primaryPhoto: null,
    publishedAt: NOW,
  };
}

describe("Rental availability API composition", () => {
  it("filters effective long-term occupancy while retaining short-term listings in one batch", async () => {
    const batch = vi.fn(async () => [
      { rentableAssetId: LONG_TERM, catalogDisposition: "REMOVE_FROM_RENTAL_CATALOG" as const },
      { rentableAssetId: SHORT_TERM, catalogDisposition: "AVAILABLE_FOR_INTERVAL" as const },
    ]);
    const useCase = new ListRentablePublicProperties({
      execute: async () => ({ items: [item(LONG_TERM, "LONG_TERM_RENTAL"), item(SHORT_TERM, "SHORT_TERM_RENTAL")] }),
    }, { execute: batch }, { now: () => NOW });
    const page = await useCase.execute({ tenantId: TENANT });
    expect(page.items.map((property) => property.publicPropertyId)).toEqual([SHORT_TERM]);
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("continues keyset pages until unavailable candidates no longer under-fill the public page", async () => {
    const third = "44444444-4444-4444-8444-444444444444";
    const execute = vi.fn(async (input: { cursor?: { publicPropertyId: string } }) => input.cursor === undefined
      ? { items: [item(LONG_TERM, "SHORT_TERM_RENTAL"), item(SHORT_TERM, "SHORT_TERM_RENTAL")], nextCursor: { publishedAt: NOW, publicPropertyId: SHORT_TERM } }
      : { items: [item(third, "SHORT_TERM_RENTAL")] });
    const batch = vi.fn(async ({ properties }: { properties: readonly { rentableAssetId: string }[] }) => properties.map((property) => ({
      rentableAssetId: property.rentableAssetId,
      catalogDisposition: property.rentableAssetId === LONG_TERM ? "UNAVAILABLE_FOR_INTERVAL" as const : "AVAILABLE_FOR_INTERVAL" as const,
    })));
    const page = await new ListRentablePublicProperties({ execute }, { execute: batch }, { now: () => NOW }).execute({
      tenantId: TENANT, limit: 2, transactionTypes: ["SHORT_TERM_RENTAL"],
      availableFrom: "2026-10-10T00:00:00.000Z", availableTo: "2026-10-12T00:00:00.000Z",
    });
    expect(page.items.map((property) => property.publicPropertyId)).toEqual([SHORT_TERM, third]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(batch).toHaveBeenCalledTimes(2);
    expect(page.nextCursor).toBeUndefined();
  });

  it("does not invoke Rental Operations for a sale-only catalog page", async () => {
    const sale = { ...item(SHORT_TERM, "SHORT_TERM_RENTAL"), transactionType: "SALE" as const,
      commercialTerms: { kind: "SALE" as const, currency: "XOF", salePriceAmountMinor: 1_000_000 } };
    const batch = vi.fn();
    const page = await new ListRentablePublicProperties({ execute: async () => ({ items: [sale] }) }, { execute: batch }, { now: () => NOW })
      .execute({ tenantId: TENANT, transactionTypes: ["SALE"] });
    expect(page.items).toEqual([sale]);
    expect(batch).not.toHaveBeenCalled();
  });

  it("does not probe Rental Operations when the public Property is unpublished", async () => {
    const check = vi.fn();
    const useCase = new RetrievePublicRentalAvailability({
      execute: async () => { throw new PublicPropertyNotFoundError(); },
    }, { execute: check }, { now: () => NOW });
    await expect(useCase.execute({
      tenantId: TENANT,
      propertyId: LONG_TERM,
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-02T00:00:00.000Z",
    })).rejects.toBeInstanceOf(PublicPropertyNotFoundError);
    expect(check).not.toHaveBeenCalled();
  });

  it("sanitizes public conflicts while preserving next availability", async () => {
    const publicProperty = {
      ...item(SHORT_TERM, "SHORT_TERM_RENTAL"),
      description: null,
      details: {},
      gallery: [],
      amenities: [],
    };
    const useCase = new RetrievePublicRentalAvailability({
      execute: async () => publicProperty,
    }, {
      execute: async () => ({
        available: false,
        requestedInterval: {
          startsAt: "2026-10-10T00:00:00.000Z",
          endsAt: "2026-10-12T00:00:00.000Z",
        },
        conflicts: [{
          conflictId: "44444444-4444-4444-8444-444444444444",
          kind: "OPERATIONAL_BLOCK" as const,
          startsAt: "2026-10-10T00:00:00.000Z",
          endsAt: "2026-10-11T00:00:00.000Z",
        }],
        nextAvailableAt: "2026-10-11T00:00:00.000Z",
        catalogDisposition: "UNAVAILABLE_FOR_INTERVAL" as const,
      }),
    }, { now: () => NOW });
    const response = await useCase.execute({
      tenantId: TENANT, propertyId: SHORT_TERM,
      startsAt: "2026-10-10T00:00:00.000Z", endsAt: "2026-10-12T00:00:00.000Z",
    });
    expect(response).toMatchObject({
      requestedPeriodAvailable: false,
      nextAvailability: "2026-10-11T00:00:00.000Z",
    });
    expect(response).not.toHaveProperty("conflictTypes");
    expect(JSON.stringify(response)).not.toContain("44444444-4444-4444-8444-444444444444");
  });
});
