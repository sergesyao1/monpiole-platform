import { describe, expect, it } from "vitest";

import { compareInspectionConditions } from "../../services/rental-operations/src/application/property-inspections.js";

describe("Rental Operations inspection comparison", () => {
  it("reports changed condition, new damage and missing items without financial interpretation", () => {
    const differences = compareInspectionConditions([
      { area: "Cuisine", item: "Réfrigérateur", assessment: "GOOD", damageObserved: false },
      { area: "Séjour", item: "Table", assessment: "GOOD", damageObserved: false },
      { area: "Chambre", item: "Lit", assessment: "GOOD", damageObserved: false },
    ], [
      { area: "Cuisine", item: "Réfrigérateur", assessment: "DAMAGED", damageObserved: true },
      { area: "Séjour", item: "Table", assessment: "FAIR", damageObserved: false },
      { area: "Chambre", item: "Lit", assessment: "MISSING", damageObserved: false },
    ]);
    expect(differences.map((difference) => difference.kind)).toEqual(["NEW_DAMAGE", "CHANGED_CONDITION", "MISSING_ITEM"]);
  });
});
