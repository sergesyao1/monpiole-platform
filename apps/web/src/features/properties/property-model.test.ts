import { describe, expect, it } from "vitest";

import {
  pricingUnitLabels, propertyStatusLabels, propertyTypeLabels, transactionTypeLabels,
} from "./property-model.js";

describe("présentation française Property", () => {
  it("traduit les enums métier sans exposer leurs valeurs techniques", () => {
    expect(propertyStatusLabels.DRAFT).toBe("Brouillon");
    expect(propertyTypeLabels).toEqual({
      APARTMENT: "Appartement", HOUSE: "Maison", LAND: "Terrain", COMMERCIAL: "Local commercial", OTHER: "Autre",
    });
    expect(transactionTypeLabels).toEqual({
      LONG_TERM_RENTAL: "Location longue durée", SHORT_TERM_RENTAL: "Location courte durée", SALE: "Vente",
    });
    expect(pricingUnitLabels).toEqual({ MONTH: "Mensuel", NIGHT: "Nuit", WEEK: "Semaine" });
  });
});
