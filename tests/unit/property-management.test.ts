import { describe, expect, it } from "vitest";
import {
  CreateProperty, InvalidPropertyInputError, InvalidPropertyServerValueError, PersistedPropertyCorruptionError,
  Property, PropertyForbiddenError, PropertyNotFoundError, RetrieveProperty, type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHORITY = { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"] as const, tenantIds: [TENANT_A] };
const input = { title: "  Apartment Cocody  ", description: "  Balcony  ", propertyType: "APARTMENT" as const,
  transactionType: "LONG_TERM_RENTAL" as const,
  location: { country: "CI", city: " Abidjan ", district: " Cocody ", addressLine: " Riviera " } };

class MemoryRepository implements PropertyRepository {
  readonly values = new Map<string, Property>();
  async save(property: Property) { this.values.set(`${property.values.tenantId}:${property.values.propertyId}`, property); }
  async findById(tenantId: string, propertyId: string) { return this.values.get(`${tenantId}:${propertyId}`); }
}

describe("Property Domain and Application", () => {
  function useCases(repository = new MemoryRepository()) {
    return { repository, create: new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }), retrieve: new RetrieveProperty(repository) };
  }
  it("creates a normalized DRAFT owned by the single authenticated tenant", async () => {
    const { create } = useCases();
    await expect(create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID })).resolves.toMatchObject({
      propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Apartment Cocody", description: "Balcony", status: "DRAFT",
      location: { city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    });
  });
  it("rejects blank and overlong titles", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, title: " " })).toThrow(InvalidPropertyInputError);
    expect(() => Property.create({ ...base, title: "x".repeat(201) })).toThrow(InvalidPropertyInputError);
  });
  it("rejects unsupported property and transaction types", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, propertyType: "CASTLE" as never })).toThrow(InvalidPropertyInputError);
    expect(() => Property.create({ ...base, transactionType: "GIFT" as never })).toThrow(InvalidPropertyInputError);
  });
  it("separates invalid server values and persisted corruption from client input", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, propertyId: "invalid" })).toThrow(InvalidPropertyServerValueError);
    expect(() => Property.rehydrate({ ...base, status: "PUBLISHED" as never })).toThrow(PersistedPropertyCorruptionError);
  });
  it("rejects missing grants and ambiguous multi-tenant authority before persistence", async () => {
    const { create, repository } = useCases();
    await expect(create.execute({ ...input, correlationId: PROPERTY_ID, authority: { ...AUTHORITY, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(create.execute({ ...input, correlationId: PROPERTY_ID, authority: { ...AUTHORITY, tenantIds: [TENANT_A, TENANT_B] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    expect(repository.values.size).toBe(0);
  });
  it("retrieves structurally by authenticated tenant and hides another tenant", async () => {
    const { create, retrieve } = useCases(); await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    await expect(retrieve.execute({ authority: AUTHORITY, propertyId: PROPERTY_ID })).resolves.toMatchObject({ tenantId: TENANT_A });
    await expect(retrieve.execute({ authority: { ...AUTHORITY, tenantIds: [TENANT_B] }, propertyId: PROPERTY_ID })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
});
