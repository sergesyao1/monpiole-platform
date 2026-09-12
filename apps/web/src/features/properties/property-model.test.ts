import { describe, expect, it } from "vitest";

import {
  formatMinorAmount, formatPublicationDate, minorAmountToInputValue,
  pricingUnitLabels, propertyStatusLabels, propertyTypeLabels, transactionTypeLabels,
} from "./property-model.js";

describe("présentation française Property", () => {
  it("traduit les enums métier sans exposer leurs valeurs techniques", () => {
    expect(propertyStatusLabels.DRAFT).toBe("Brouillon");
    expect(propertyStatusLabels.PUBLISHED).toBe("Publié");
    expect(propertyStatusLabels.WITHDRAWN).toBe("Retiré du catalogue");
    expect(propertyTypeLabels).toEqual({
      APARTMENT: "Appartement", HOUSE: "Maison", LAND: "Terrain", OFFICE: "Bureau", SHOP: "Boutique / Local commercial",
      BUILDING: "Immeuble", COMPLEX: "Ensemble immobilier / Résidence", COMMERCIAL: "Local commercial", OTHER: "Autre",
    });
    expect(transactionTypeLabels).toEqual({
      LONG_TERM_RENTAL: "Location longue durée", SHORT_TERM_RENTAL: "Location courte durée", SALE: "Vente",
    });
    expect(pricingUnitLabels).toEqual({ MONTH: "Mensuel", NIGHT: "Nuit", WEEK: "Semaine" });
  });
  it("formate un instant de publication de façon déterministe en français", () => {
    expect(formatPublicationDate("2026-08-25T16:00:00.000Z")).toMatch(/25 août 2026.*16:00/u);
  });
  it("préremplit et affiche les montants selon la devise", () => {
    expect(minorAmountToInputValue(125000, "XOF")).toBe("125000");
    expect(minorAmountToInputValue(125000, "EUR")).toBe("1250.00");
    expect(minorAmountToInputValue(125000, "USD")).toBe("1250.00");
    expect(formatMinorAmount(125000, "XOF").replaceAll(/[\s\u202f\u00a0]/gu, " ")).toBe("125 000 FCFA");
  });
});
