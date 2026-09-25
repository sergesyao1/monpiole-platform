import { describe, expect, it } from "vitest";

import {
  CreatePropertyBuilding,
  CreatePropertyUnit,
  ListPropertyBuildings,
  Property,
  PropertyBuildingNotFoundError,
  PropertyForbiddenError,
  PropertyNotFoundError,
  type CompositionCursor,
  type CompositionPage,
  type PropertyBuilding,
  type PropertyBuildingUnit,
  type PropertyCompositionRepository,
  type PropertyAuthority,
  type PropertyGrant,
  type PropertyRepository,
  type PropertyUnitView,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BUILDING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNIT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW = "2026-08-29T10:00:00.000Z";
const authority = (grants: readonly PropertyGrant[], tenantIds: readonly string[] = [TENANT_A]): PropertyAuthority => ({ actorId: "actor", authorityId: "authority", grants, tenantIds });

function standalone() {
  return Property.create({
    propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Résidence", propertyType: "HOUSE",
    transactionType: "SALE", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" },
    createdAt: NOW, updatedAt: NOW,
  });
}

class MemoryProperties implements PropertyRepository {
  property: Property | undefined = standalone();
  saveCalls = 0;
  async saveStandalone(): Promise<void> { this.saveCalls += 1; }
  async findById(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.property : undefined;
  }
  async updateAtomically() { return undefined; }
}

class MemoryComposition implements PropertyCompositionRepository {
  createBuildingCalls = 0;
  createUnitCalls = 0;
  relation: PropertyBuildingUnit | undefined;
  unit: Property | undefined;
  createBuildingResult: PropertyBuilding | undefined;
  createUnitResult: PropertyUnitView | undefined;

  async createBuilding(_tenantId: string, _propertyId: string, building: PropertyBuilding) {
    this.createBuildingCalls += 1;
    return this.createBuildingResult ?? building;
  }
  async listBuildings(_tenantId: string, _propertyId: string, _limit: number, _cursor?: CompositionCursor): Promise<CompositionPage<Readonly<PropertyBuilding["values"]>> | undefined> {
    return { items: [], nextCursor: undefined };
  }
  async updateBuilding() { return undefined; }
  async createUnit(_tenantId: string, _propertyId: string, relation: PropertyBuildingUnit, unit: Property, _trace: { readonly correlationId: string; readonly actorId: string }): Promise<PropertyUnitView | undefined> {
    this.createUnitCalls += 1;
    this.relation = relation;
    this.unit = unit;
    return this.createUnitResult ?? { unitCode: relation.values.unitCode, property: unit.values };
  }
  async listUnits(): Promise<CompositionPage<PropertyUnitView> | undefined> { return { items: [] }; }
  async updateUnitCode() { return undefined; }
  async createComplexChild(_tenantId: string, _complexPropertyId: string, childCode: string, child: Property) {
    return { childCode, property: child.values };
  }
  async listComplexChildren() { return { items: [] }; }
}

const unitFields = {
  unitCode: " a-101 ", title: "Appartement A-101", description: "Étage 1", propertyType: "APARTMENT" as const,
  transactionType: "LONG_TERM_RENTAL" as const,
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1, A-101" },
};

describe("Property composition application", () => {
  it("refuse un grant absent ou une autorité tenant ambiguë avant tout effet", async () => {
    const forbiddenAuthorities = [
      authority([], [TENANT_A]),
      authority(["CREATE_PROPERTY_UNIT"], [TENANT_A, TENANT_B]),
    ] as const;
    for (const forbiddenAuthority of forbiddenAuthorities) {
      const composition = new MemoryComposition();
      const useCase = new CreatePropertyUnit(composition, { generate: () => UNIT_ID }, { now: () => NOW });
      await expect(useCase.execute({ authority: forbiddenAuthority, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields }))
        .rejects.toBeInstanceOf(PropertyForbiddenError);
      expect(composition.createUnitCalls).toBe(0);
    }
  });

  it("crée une Unit uniquement avec sa relation Domain canonique et le tenant autorisé", async () => {
    const composition = new MemoryComposition();
    const result = await new CreatePropertyUnit(composition, { generate: () => UNIT_ID }, { now: () => NOW }).execute({
      authority: authority(["CREATE_PROPERTY_UNIT"]), correlationId: PROPERTY_ID,
      propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields,
    });
    expect(result).toMatchObject({ unitCode: "A-101", property: { propertyId: UNIT_ID, tenantId: TENANT_A, structuralRole: "UNIT" } });
    expect(composition.relation?.values).toEqual({ tenantId: TENANT_A, buildingId: BUILDING_ID, unitPropertyId: UNIT_ID, unitCode: "A-101", createdAt: NOW, updatedAt: NOW });
    expect(composition.unit?.values.structuralRole).toBe("UNIT");
  });

  it("ne contacte pas le repository Composition si le parent n’existe pas", async () => {
    const properties = new MemoryProperties(); properties.property = undefined;
    const composition = new MemoryComposition();
    const useCase = new CreatePropertyBuilding(properties, composition, { generate: () => BUILDING_ID }, { now: () => NOW });
    await expect(useCase.execute({ authority: authority(["CREATE_PROPERTY_BUILDING"]), correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, buildingCode: "BAT-A", name: "A" }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    expect(composition.createBuildingCalls).toBe(0);
  });

  it("conserve les erreurs non révélatrices de listing et de création Unit", async () => {
    const composition = new MemoryComposition();
    composition.listBuildings = async () => undefined;
    await expect(new ListPropertyBuildings(composition).execute({ authority: authority(["RETRIEVE_PROPERTY_COMPOSITION"]), correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, limit: 20 }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    composition.createUnit = async () => undefined;
    await expect(new CreatePropertyUnit(composition, { generate: () => UNIT_ID }, { now: () => NOW }).execute({ authority: authority(["CREATE_PROPERTY_UNIT"]), correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, ...unitFields }))
      .rejects.toBeInstanceOf(PropertyBuildingNotFoundError);
  });
});
