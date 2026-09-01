import { describe, expect, it } from "vitest";

import {
  PersistedPropertyCorruptionError,
  Property,
  PropertyAvailabilityDerivedFromUnitsError,
  PropertyForbiddenError,
  PropertyNotFoundError,
  RetrievePropertyAvailability,
  UpdatePropertyAvailability,
  type PropertyAvailabilityQuery,
  type PropertyAvailabilityReadModel,
  type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CORRELATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const INITIAL = "2026-09-01T10:00:00.000Z";
const UPDATED = "2026-09-01T11:00:00.000Z";

function directProperty(role: "STANDALONE" | "UNIT" = "STANDALONE") {
  const input = {
    propertyId: PROPERTY_ID,
    tenantId: TENANT_A,
    title: "Maison Lagune",
    propertyType: "HOUSE" as const,
    transactionType: "SALE" as const,
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: INITIAL,
    updatedAt: INITIAL,
  };
  return role === "UNIT" ? Property.createUnit(input) : Property.createStandalone(input);
}

const authority = {
  actorId: "actor",
  authorityId: "authority",
  grants: ["RETRIEVE_PROPERTY_AVAILABILITY", "UPDATE_PROPERTY_AVAILABILITY"] as const,
  tenantIds: [TENANT_A],
};

class MemoryRepository implements PropertyRepository {
  property: Property | undefined = directProperty();
  writes = 0;
  async saveStandalone() {}
  async findById(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.property : undefined;
  }
  async updateAtomically(tenantId: string, propertyId: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    if (tenantId !== TENANT_A || propertyId !== PROPERTY_ID || this.property === undefined) return undefined;
    const updated = update(this.property, []);
    if (updated !== this.property) {
      this.property = updated;
      this.writes += 1;
    }
    return this.property;
  }
}

class MemoryAvailabilityQuery implements PropertyAvailabilityQuery {
  value: PropertyAvailabilityReadModel | undefined = {
    propertyId: PROPERTY_ID,
    source: "DIRECT",
    structuralRole: "STANDALONE",
    configured: false,
  };
  calls: Array<{ tenantId: string; propertyId: string }> = [];
  async retrieve(tenantId: string, propertyId: string) {
    this.calls.push({ tenantId, propertyId });
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.value : undefined;
  }
}

describe("Property availability and occupancy", () => {
  it("starts unconfigured for STANDALONE and UNIT Properties", () => {
    expect(directProperty("STANDALONE").values.availability).toBeUndefined();
    expect(directProperty("UNIT").values.availability).toBeUndefined();
  });

  it.each([
    ["AVAILABLE", "VACANT"],
    ["AVAILABLE", "OCCUPIED"],
    ["UNAVAILABLE", "VACANT"],
    ["UNAVAILABLE", "OCCUPIED"],
  ] as const)("accepts the independent %s/%s pair", (availabilityStatus, occupancyStatus) => {
    expect(directProperty().defineAvailability(availabilityStatus, occupancyStatus, UPDATED).values.availability)
      .toEqual({ availabilityStatus, occupancyStatus, updatedAt: UPDATED });
  });

  it("replays the same pair without another aggregate or timestamp", () => {
    const configured = directProperty().defineAvailability("AVAILABLE", "VACANT", UPDATED);
    expect(configured.defineAvailability("AVAILABLE", "VACANT", "invalid")).toBe(configured);
  });

  it("clears a direct snapshot when the Property becomes COMPOSITE and rejects direct configuration", () => {
    const configured = directProperty().defineAvailability("AVAILABLE", "OCCUPIED", UPDATED);
    const composite = configured.becomeComposite("2026-09-01T12:00:00.000Z");
    expect(composite.values).toMatchObject({ structuralRole: "COMPOSITE" });
    expect(composite.values.availability).toBeUndefined();
    expect(() => composite.defineAvailability("AVAILABLE", "VACANT", UPDATED))
      .toThrow(PropertyAvailabilityDerivedFromUnitsError);
  });

  it("rejects corrupt persisted status values and direct snapshots on COMPOSITE", () => {
    const configured = directProperty().defineAvailability("AVAILABLE", "VACANT", UPDATED);
    expect(() => Property.rehydrate({
      ...configured.values,
      availability: { ...configured.values.availability!, occupancyStatus: "LEASED" as never },
    })).toThrow(PersistedPropertyCorruptionError);
    expect(() => Property.rehydrate({ ...configured.values, structuralRole: "COMPOSITE" }))
      .toThrow(PersistedPropertyCorruptionError);
  });

  it("updates through the tenant lock and replays without a clock read or write", async () => {
    const repository = new MemoryRepository();
    let clockCalls = 0;
    const update = new UpdatePropertyAvailability(repository, { now: () => { clockCalls += 1; return UPDATED; } });
    const command = {
      authority,
      correlationId: CORRELATION_ID,
      propertyId: PROPERTY_ID,
      availabilityStatus: "AVAILABLE" as const,
      occupancyStatus: "OCCUPIED" as const,
    };
    await expect(update.execute(command)).resolves.toMatchObject({
      source: "DIRECT", configured: true, availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED",
      updatedAt: UPDATED, canUpdateAvailability: true,
    });
    await expect(update.execute(command)).resolves.toMatchObject({ updatedAt: UPDATED });
    expect(clockCalls).toBe(1);
    expect(repository.writes).toBe(1);
  });

  it("authorizes before persistence and hides cross-tenant or missing Properties", async () => {
    const repository = new MemoryRepository();
    const update = new UpdatePropertyAvailability(repository, { now: () => UPDATED });
    const command = {
      authority,
      correlationId: CORRELATION_ID,
      propertyId: PROPERTY_ID,
      availabilityStatus: "AVAILABLE" as const,
      occupancyStatus: "VACANT" as const,
    };
    await expect(update.execute({ ...command, authority: { ...authority, grants: [] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(update.execute({ ...command, authority: { ...authority, tenantIds: [TENANT_A, TENANT_B] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(update.execute({ ...command, authority: { ...authority, tenantIds: [TENANT_B] } }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    expect(repository.writes).toBe(0);
  });

  it("projects update capability without exposing grants and never enables COMPOSITE editing", async () => {
    const query = new MemoryAvailabilityQuery();
    const retrieve = new RetrievePropertyAvailability(query);
    await expect(retrieve.execute({ authority, propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ configured: false, canUpdateAvailability: true });
    await expect(retrieve.execute({ authority: { ...authority, grants: ["RETRIEVE_PROPERTY_AVAILABILITY"] }, propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ canUpdateAvailability: false });
    query.value = {
      propertyId: PROPERTY_ID, source: "DERIVED_FROM_UNITS", structuralRole: "COMPOSITE",
      availabilityStatus: "NOT_CONFIGURED", totalUnitCount: 0, configuredUnitCount: 0,
      availableUnitCount: 0, unavailableUnitCount: 0, vacantUnitCount: 0,
      occupiedUnitCount: 0, unconfiguredUnitCount: 0,
    };
    const composite = await retrieve.execute({ authority, propertyId: PROPERTY_ID });
    expect(composite).toMatchObject({ source: "DERIVED_FROM_UNITS", canUpdateAvailability: false });
    expect(composite).not.toHaveProperty("grants");
  });
});
