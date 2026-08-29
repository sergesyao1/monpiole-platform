import { describe, expect, it } from "vitest";
import { InvalidPropertyCompositionServerValueError, Property, PropertyBuilding, PropertyBuildingUnit, PropertyStructuralRoleConflictError, normalizeStructuralCode } from "../../services/property-management/src/index.js";
const IDS = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", propertyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", buildingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }; const NOW = "2026-08-28T10:00:00.000Z";
const values = { propertyId: IDS.propertyId, tenantId: IDS.tenantId, title: "Bien", propertyType: "HOUSE" as const, transactionType: "SALE" as const, location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" }, createdAt: NOW, updatedAt: NOW };
function property(role: "STANDALONE" | "UNIT") { return role === "UNIT" ? Property.createUnit(values) : Property.create(values); }
describe("Property composition domain", () => {
  it("canonise les codes et normalise un Building", () => { const building = PropertyBuilding.create({ ...IDS, buildingCode: " bat-a ", name: " Immeuble A ", createdAt: NOW, updatedAt: NOW }); expect(building.values).toMatchObject({ buildingCode: "BAT-A", name: "Immeuble A" }); expect(normalizeStructuralCode(" a-101 ", "unitCode")).toBe("A-101"); });
  it("interdit à une Unit de devenir un ensemble", () => { expect(property("STANDALONE").becomeComposite(NOW).values.structuralRole).toBe("COMPOSITE"); expect(() => property("UNIT").becomeComposite(NOW)).toThrow(PropertyStructuralRoleConflictError); });
  it("réserve la création générique aux biens autonomes", () => {
    expect(Property.create(values).values.structuralRole).toBe("STANDALONE");
    expect(Property.createUnit(values).values.structuralRole).toBe("UNIT");
  });
  it("valide la relation Unit, son tenant, son identité et son code canonique", () => {
    const unit = property("UNIT");
    const relation = PropertyBuildingUnit.create({ tenantId: IDS.tenantId, buildingId: IDS.buildingId, unitPropertyId: IDS.propertyId, unitCode: " a-101 ", createdAt: NOW, updatedAt: NOW }, unit);
    expect(relation.values.unitCode).toBe("A-101");
    expect(relation.updateCode(" b-202 ", "2026-08-28T11:00:00.000Z").values).toMatchObject({ unitCode: "B-202", updatedAt: "2026-08-28T11:00:00.000Z" });
    expect(() => PropertyBuildingUnit.create({ ...relation.values, tenantId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }, unit)).toThrow(InvalidPropertyCompositionServerValueError);
    expect(() => PropertyBuildingUnit.create({ ...relation.values }, property("STANDALONE"))).toThrow(InvalidPropertyCompositionServerValueError);
    expect(() => PropertyBuildingUnit.rehydrate({ ...relation.values, unitCode: "a-101" }, unit)).toThrow(InvalidPropertyCompositionServerValueError);
  });
});
