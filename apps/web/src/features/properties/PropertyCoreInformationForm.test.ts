import { describe, expect, it } from "vitest";
import { coreInformationInputFromForm } from "./PropertyCoreInformationForm.js";

describe("informations fondamentales Property", () => {
  it("normalise le formulaire et omet une description vide", () => {
    const values = new FormData();
    values.set("title", "  Villa Lagune  "); values.set("description", "   "); values.set("country", "ci");
    values.set("city", " Abidjan "); values.set("district", " Marcory "); values.set("addressLine", " Zone 4 ");
    expect(coreInformationInputFromForm(values)).toEqual({
      title: "Villa Lagune",
      location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" },
    });
  });
});
