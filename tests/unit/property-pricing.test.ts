import { describe, expect, it } from "vitest";

import {
  IncompatibleCommercialTermsError,
  InvalidPropertyDetailsError,
  PersistedPropertyCorruptionError,
  Property,
  PropertyForbiddenError,
  PropertyNotFoundError,
  PropertyPublicationRequirementsNotMetError,
  SetPropertyPricing,
  type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CORRELATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CREATED_AT = "2026-09-01T10:00:00.000Z";
const UPDATED_AT = "2026-09-01T11:00:00.000Z";

function property(transactionType: "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL" | "SALE" = "SALE") {
  return Property.create({
    propertyId: PROPERTY_ID,
    tenantId: TENANT_A,
    title: "Maison Lagune",
    propertyType: "HOUSE",
    transactionType,
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
}

function legacyProperty(currency = "EUR", amount = 0) {
  return Property.rehydrate({
    ...property("SALE").values,
    details: { rooms: 4 },
    commercialTerms: { kind: "SALE", currency, salePriceAmountMinor: amount },
  }, { allowLegacyPricing: true });
}

const authority = {
  actorId: "actor",
  authorityId: "authority",
  grants: ["UPDATE_PROPERTY_PRICING"] as const,
  tenantIds: [TENANT_A],
};

class MemoryRepository implements PropertyRepository {
  value: Property | undefined = property();
  writes = 0;
  async saveStandalone() {}
  async findById(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.value : undefined;
  }
  async updateAtomically(tenantId: string, propertyId: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    if (tenantId !== TENANT_A || propertyId !== PROPERTY_ID || this.value === undefined) return undefined;
    const next = update(this.value, []);
    if (next !== this.value) { this.value = next; this.writes += 1; }
    return this.value;
  }
}

describe("advanced Property pricing", () => {
  it("accepts the strict advanced pricing variants", () => {
    expect(property("LONG_TERM_RENTAL").setPricing({
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 350_000, rentPeriod: "MONTH",
      securityDepositAmountMinor: 700_000, chargesAmountMinor: 25_000, agencyFeeAmountMinor: 350_000,
    }, UPDATED_AT).values.commercialTerms).toEqual({
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 350_000, rentPeriod: "MONTH",
      securityDepositAmountMinor: 700_000, chargesAmountMinor: 25_000, agencyFeeAmountMinor: 350_000,
    });
    expect(property("SHORT_TERM_RENTAL").setPricing({
      kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45_000, pricingUnit: "NIGHT",
      cleaningFeeAmountMinor: 5_000, securityDepositAmountMinor: 100_000, minimumStayNights: 3,
    }, UPDATED_AT).values.commercialTerms).toMatchObject({ cleaningFeeAmountMinor: 5_000, minimumStayNights: 3 });
    expect(property("SALE").setPricing({
      kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000,
    }, UPDATED_AT).values.commercialTerms).toMatchObject({ agencyFeeAmountMinor: 5_000_000 });
  });

  it.each([
    [{ kind: "SALE", currency: "EUR", salePriceAmountMinor: 1 }],
    [{ kind: "SALE", currency: "XOF", salePriceAmountMinor: 0 }],
    [{ kind: "SALE", currency: "XOF", salePriceAmountMinor: -1 }],
    [{ kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 1, pricingUnit: "NIGHT", minimumStayNights: 0 }],
    [{ kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 1, pricingUnit: "NIGHT", minimumStayNights: 2_147_483_648 }],
  ] as const)("rejects a non-strict new pricing payload %#", (pricing) => {
    const target = pricing.kind === "SHORT_TERM_RENTAL" ? property("SHORT_TERM_RENTAL") : property("SALE");
    expect(() => target.setPricing(pricing, UPDATED_AT)).toThrow(InvalidPropertyDetailsError);
  });

  it("rejects a pricing kind incompatible with the immutable transaction type", () => {
    expect(() => property("SALE").setPricing({
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH",
    }, UPDATED_AT)).toThrow(IncompatibleCommercialTermsError);
  });

  it("rehydrates legacy zero/foreign-currency rows only through the explicit compatibility path", () => {
    expect(legacyProperty().values.commercialTerms).toEqual({
      kind: "SALE", currency: "EUR", salePriceAmountMinor: 0,
    });
    expect(() => Property.rehydrate({
      ...property().values,
      details: { rooms: 4 },
      commercialTerms: { kind: "SALE", currency: "EUR", salePriceAmountMinor: 0 },
    })).toThrow(PersistedPropertyCorruptionError);
  });

  it("preserves legacy pricing on detail-only writes but blocks a new publication", () => {
    const legacy = legacyProperty();
    const detailsUpdated = legacy.defineDetails({ rooms: 5 }, undefined, UPDATED_AT);
    expect(detailsUpdated.values.commercialTerms).toEqual(legacy.values.commercialTerms);
    expect(() => detailsUpdated.publish("2026-09-01T12:00:00.000Z")).toThrowError(expect.objectContaining({
      code: "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
      missingRequirements: expect.arrayContaining(["COMMERCIAL_TERMS"]),
    }) as PropertyPublicationRequirementsNotMetError);
  });

  it("sets pricing atomically and replays identical strict pricing without a clock read or write", async () => {
    const repository = new MemoryRepository();
    let clockCalls = 0;
    const useCase = new SetPropertyPricing(repository, { now: () => { clockCalls += 1; return UPDATED_AT; } });
    const command = {
      authority,
      correlationId: CORRELATION_ID,
      propertyId: PROPERTY_ID,
      pricing: { kind: "SALE" as const, currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 },
    };
    await expect(useCase.execute(command)).resolves.toMatchObject({
      commercialTerms: { salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 },
      updatedAt: UPDATED_AT,
    });
    await expect(useCase.execute(command)).resolves.toMatchObject({ updatedAt: UPDATED_AT });
    expect(clockCalls).toBe(1);
    expect(repository.writes).toBe(1);
  });

  it("authorizes before persistence and hides missing or cross-tenant Properties", async () => {
    const repository = new MemoryRepository();
    const useCase = new SetPropertyPricing(repository, { now: () => UPDATED_AT });
    const command = {
      authority,
      correlationId: CORRELATION_ID,
      propertyId: PROPERTY_ID,
      pricing: { kind: "SALE" as const, currency: "XOF", salePriceAmountMinor: 1 },
    };
    await expect(useCase.execute({ ...command, authority: { ...authority, grants: [] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(useCase.execute({ ...command, authority: { ...authority, tenantIds: [TENANT_A, TENANT_B] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(useCase.execute({ ...command, authority: { ...authority, tenantIds: [TENANT_B] } }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    repository.value = undefined;
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(PropertyNotFoundError);
    expect(repository.writes).toBe(0);
  });
});
