import { describe, expect, it } from "vitest";

import { detailsInputFromForm } from "./PropertyDetailsForm.js";
import type { Property } from "./property-model.js";

const baseProperty: Property = {
  propertyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Bien test",
  propertyType: "APARTMENT",
  transactionType: "SHORT_TERM_RENTAL",
  status: "DRAFT", structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue test" },
  createdAt: "2026-08-27T10:00:00.000Z",
  updatedAt: "2026-08-27T10:00:00.000Z",
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("variantes commerciales Property", () => {
  it("construit les conditions de location courte durée", () => {
    const input = detailsInputFromForm(baseProperty, formData({
      currency: "XOF", rateAmountMinor: "45000", pricingUnit: "NIGHT",
    }));

    expect(input.commercialTerms).toEqual({
      kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45000, pricingUnit: "NIGHT",
    });
  });

  it("construit les conditions de vente", () => {
    const input = detailsInputFromForm(
      { ...baseProperty, transactionType: "SALE" },
      formData({ currency: "XOF", salePriceAmountMinor: "125000000" }),
    );

    expect(input.commercialTerms).toEqual({
      kind: "SALE", currency: "XOF", salePriceAmountMinor: 125000000,
    });
  });

  it.each([
    ["XOF", "125000", 125000],
    ["EUR", "1250.00", 125000],
    ["USD", "1250.00", 125000],
  ] as const)("convertit la saisie %s selon les décimales de la devise", (currency, entered, expectedMinor) => {
    const input = detailsInputFromForm(
      { ...baseProperty, transactionType: "SALE" },
      formData({ currency, salePriceAmountMinor: entered }),
    );
    expect(input.commercialTerms).toEqual({
      kind: "SALE", currency, salePriceAmountMinor: expectedMinor,
    });
  });
});
