import { describe, expect, it } from "vitest";
import {
  CreateProperty, InvalidPropertyInputError, InvalidPropertyServerValueError, PersistedPropertyCorruptionError,
  Property, PropertyForbiddenError, PropertyNotFoundError, RetrieveProperty, type PropertyRepository,
  UpdatePropertyCoreInformation, UpdatePropertyDetails, InvalidPropertyDetailsError, IncompatibleCommercialTermsError,
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
  async updateAtomically(tenantId: string, propertyId: string, update: (property: Property) => Property) {
    const key = `${tenantId}:${propertyId}`; const property = this.values.get(key);
    if (property === undefined) return undefined; const updated = update(property); this.values.set(key, updated); return updated;
  }
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
  it("validates details and each compatible commercial variant", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    const details = { usableSurfaceSquareMeters: 80.5, rooms: 4, bedrooms: 2, bathrooms: 1, furnished: true };
    expect(Property.create(base).defineDetails(details, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH", securityDepositAmountMinor: 500_000, chargesAmountMinor: 25_000 }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("LONG_TERM_RENTAL");
    expect(Property.create({ ...base, transactionType: "SHORT_TERM_RENTAL" }).defineDetails(details, { kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 50_000, pricingUnit: "NIGHT" }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("SHORT_TERM_RENTAL");
    expect(Property.create({ ...base, transactionType: "SALE" }).defineDetails(details, { kind: "SALE", currency: "XOF", salePriceAmountMinor: 75_000_000 }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("SALE");
  });
  it("rejects impossible details, negative money, and incompatible terms", () => {
    const property = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" });
    expect(() => property.defineDetails({ rooms: 1, bedrooms: 2 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ usableSurfaceSquareMeters: -1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ rooms: 1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: -1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ rooms: 1 }, { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 }, "2026-08-25T13:00:00.000Z")).toThrow(IncompatibleCommercialTermsError);
  });
  it("updates details through the tenant-scoped application operation", async () => {
    const { create, repository } = useCases(); await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    await expect(update.execute({ authority: { ...AUTHORITY, grants: [...AUTHORITY.grants, "UPDATE_PROPERTY_DETAILS"] }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID,
      details: { rooms: 3, bedrooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 300_000, rentPeriod: "MONTH" } }))
      .resolves.toMatchObject({ details: { rooms: 3, bedrooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL" }, updatedAt: "2026-08-25T14:00:00.000Z" });
  });
  it("updates only normalized core information through the tenant-scoped operation", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    await expect(update.execute({
      authority: { ...AUTHORITY, grants: [...AUTHORITY.grants, "UPDATE_PROPERTY_CORE_INFORMATION"] },
      correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, title: "  Villa Lagune  ", description: "  Rénovée  ",
      location: { country: "CI", city: " Abidjan ", district: " Marcory ", addressLine: " Zone 4 " },
    })).resolves.toMatchObject({
      title: "Villa Lagune", description: "Rénovée", propertyType: "APARTMENT",
      transactionType: "LONG_TERM_RENTAL", status: "DRAFT",
      location: { city: "Abidjan", district: "Marcory", addressLine: "Zone 4" },
      updatedAt: "2026-08-25T15:00:00.000Z",
    });
  });
  it("rejects invalid core information and unauthorized or cross-tenant updates", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    const command = { authority: { ...AUTHORITY, grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] as const }, correlationId: PROPERTY_ID,
      propertyId: PROPERTY_ID, title: "Villa", location: input.location };
    await expect(update.execute({ ...command, title: " " })).rejects.toBeInstanceOf(InvalidPropertyInputError);
    await expect(update.execute({ ...command, authority: { ...command.authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(update.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
});
