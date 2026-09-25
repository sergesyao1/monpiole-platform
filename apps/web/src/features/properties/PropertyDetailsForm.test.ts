import { describe, expect, it } from "vitest";

import { detailsInputFromForm } from "./PropertyDetailsForm.js";
import type { Property } from "./property-model.js";

const baseProperty: Property = {
  propertyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Bien test",
  propertyType: "APARTMENT",
  transactionType: "SHORT_TERM_RENTAL",
  status: "DRAFT", canWithdrawFromCatalog: false, structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue test" },
  createdAt: "2026-08-27T10:00:00.000Z",
  updatedAt: "2026-08-27T10:00:00.000Z",
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("caractéristiques Property", () => {
  it("construit les caractéristiques indépendamment de la tarification", () => {
    const input = detailsInputFromForm(baseProperty, formData({
      usableSurfaceSquareMeters: "75.5", rooms: "3", bedrooms: "2", bathrooms: "1", furnished: "on",
    }));

    expect(input).toEqual({ details: {
      usableSurfaceSquareMeters: 75.5, rooms: 3, bedrooms: 2, bathrooms: 1, furnished: true,
    } });
  });

  it("n'envoie pas la tarification historique lors d'une mise à jour des caractéristiques", () => {
    const input = detailsInputFromForm({ ...baseProperty, commercialTerms: {
      kind: "SHORT_TERM_RENTAL", currency: "EUR", rateAmountMinor: 0, pricingUnit: "NIGHT",
    } }, formData({ rooms: "2" }));

    expect(input).toEqual({ details: {
      usableSurfaceSquareMeters: undefined, rooms: 2, bedrooms: undefined,
      bathrooms: undefined, furnished: false,
    } });
    expect(input).not.toHaveProperty("commercialTerms");
  });

  it("conserve les champs numériques facultatifs absents", () => {
    expect(detailsInputFromForm(baseProperty, formData({}))).toEqual({
      details: {
        usableSurfaceSquareMeters: undefined, rooms: undefined, bedrooms: undefined,
        bathrooms: undefined, furnished: false,
      },
    });
  });
});
