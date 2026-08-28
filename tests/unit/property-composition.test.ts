import { describe, expect, it } from "vitest";
import { Property, PropertyBuilding, PropertyStructuralRoleConflictError, normalizeStructuralCode } from "../../services/property-management/src/index.js";
const IDS = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", propertyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", buildingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }; const NOW = "2026-08-28T10:00:00.000Z";
function property(role: "STANDALONE" | "UNIT") { return Property.create({ propertyId: IDS.propertyId, tenantId: IDS.tenantId, title: "Bien", propertyType: "HOUSE", transactionType: "SALE", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" }, createdAt: NOW, updatedAt: NOW, structuralRole: role }); }
describe("Property composition domain", () => {
  it("canonise les codes et normalise un Building", () => { const building = PropertyBuilding.create({ ...IDS, buildingCode: " bat-a ", name: " Immeuble A ", createdAt: NOW, updatedAt: NOW }); expect(building.values).toMatchObject({ buildingCode: "BAT-A", name: "Immeuble A" }); expect(normalizeStructuralCode(" a-101 ", "unitCode")).toBe("A-101"); });
  it("interdit à une Unit de devenir un ensemble", () => { expect(property("STANDALONE").becomeComposite(NOW).values.structuralRole).toBe("COMPOSITE"); expect(() => property("UNIT").becomeComposite(NOW)).toThrow(PropertyStructuralRoleConflictError); });
});
