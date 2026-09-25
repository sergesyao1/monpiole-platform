import { describe, expect, it } from "vitest";
import {
  CreatePropertyOwner, InvalidPropertyOwnerInputError, PropertyOwner,
  PropertyOwnerNotFoundError, PropertyOwnerTypeChangeNotAllowedError,
  RetrievePropertyOwner, UpdatePropertyOwner,
  type PropertyAuthority, type PropertyOwnerRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHORITY: PropertyAuthority = {
  actorId: "actor", authorityId: "authority",
  grants: ["CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "UPDATE_PROPERTY_OWNER"], tenantIds: [TENANT_A],
};

class MemoryOwnerRepository implements PropertyOwnerRepository {
  readonly values = new Map<string, PropertyOwner>();
  async save(owner: PropertyOwner) { this.values.set(`${owner.values.tenantId}:${owner.values.ownerId}`, owner); }
  async findById(tenantId: string, ownerId: string) { return this.values.get(`${tenantId}:${ownerId}`); }
  async updateAtomically(tenantId: string, ownerId: string, update: (owner: PropertyOwner) => PropertyOwner) {
    const key = `${tenantId}:${ownerId}`; const owner = this.values.get(key); if (owner === undefined) return undefined;
    const updated = update(owner); this.values.set(key, updated); return updated;
  }
}

function individual() {
  return PropertyOwner.create({
    ownerId: OWNER_ID, tenantId: TENANT_A,
    identity: { ownerType: "INDIVIDUAL", firstName: " Jean ", lastName: " Kouassi " },
    contactInformation: { phoneNumber: " +2250700000000 ", email: "Jean.Kouassi@Example.com" },
    createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
  });
}

describe("PropertyOwner domain", () => {
  it("creates and normalizes a valid individual", () => {
    expect(individual().values).toMatchObject({
      ownerId: OWNER_ID, tenantId: TENANT_A,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" },
      contactInformation: { phoneNumber: "+2250700000000", email: "jean.kouassi@example.com" },
    });
  });

  it("creates a valid legal entity with an optional registration number", () => {
    expect(PropertyOwner.create({
      ownerId: OWNER_ID, tenantId: TENANT_A,
      identity: { ownerType: "LEGAL_ENTITY", legalName: " Immobilière Plateau SA ", registrationNumber: " CI-ABJ-2026-B-00000 " },
      contactInformation: {}, createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
    }).values.identity).toEqual({ ownerType: "LEGAL_ENTITY", legalName: "Immobilière Plateau SA", registrationNumber: "CI-ABJ-2026-B-00000" });
  });

  it.each([
    [{ ownerType: "INDIVIDUAL", firstName: " ", lastName: "Kouassi" }, "firstName"],
    [{ ownerType: "INDIVIDUAL", firstName: "Jean", lastName: " " }, "lastName"],
    [{ ownerType: "LEGAL_ENTITY", legalName: " " }, "legalName"],
  ] as const)("rejects incomplete identity %#", (identity, field) => {
    expect(() => PropertyOwner.create({
      ownerId: OWNER_ID, tenantId: TENANT_A, identity,
      contactInformation: {}, createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
    })).toThrow(expect.objectContaining({ code: "INVALID_PROPERTY_OWNER_INPUT", field }));
  });

  it.each([
    [{ email: "invalid" }, "email"], [{ phoneNumber: "  " }, "phoneNumber"],
  ] as const)("rejects invalid contact %#", (contactInformation, field) => {
    expect(() => PropertyOwner.create({
      ownerId: OWNER_ID, tenantId: TENANT_A,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" },
      contactInformation, createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
    })).toThrow(expect.objectContaining({ code: "INVALID_PROPERTY_OWNER_INPUT", field }));
  });

  it("updates mutable information while preserving identifiers and type", () => {
    const updated = individual().update(
      { ownerType: "INDIVIDUAL", firstName: "Jeannot", lastName: "Kouassi" },
      { email: "new@example.com" }, "2026-08-26T11:00:00.000Z",
    );
    expect(updated.values).toMatchObject({
      ownerId: OWNER_ID, tenantId: TENANT_A, identity: { ownerType: "INDIVIDUAL", firstName: "Jeannot" },
      contactInformation: { email: "new@example.com" }, updatedAt: "2026-08-26T11:00:00.000Z",
    });
  });

  it("forbids an owner type change", () => {
    expect(() => individual().update(
      { ownerType: "LEGAL_ENTITY", legalName: "New Company" }, {}, "2026-08-26T11:00:00.000Z",
    )).toThrow(PropertyOwnerTypeChangeNotAllowedError);
  });
});

describe("PropertyOwner application operations", () => {
  it("creates, retrieves and updates under the authorized tenant", async () => {
    const repository = new MemoryOwnerRepository();
    const create = new CreatePropertyOwner(repository, { generate: () => OWNER_ID }, { now: () => "2026-08-26T10:00:00.000Z" });
    await create.execute({ authority: AUTHORITY, correlationId: OWNER_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" }, contactInformation: {} });
    await expect(new RetrievePropertyOwner(repository).execute({ authority: AUTHORITY, ownerId: OWNER_ID }))
      .resolves.toMatchObject({ ownerId: OWNER_ID, tenantId: TENANT_A });
    await expect(new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" }).execute({
      authority: AUTHORITY, correlationId: OWNER_ID, ownerId: OWNER_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jeannot", lastName: "Kouassi" }, contactInformation: {},
    })).resolves.toMatchObject({ identity: { firstName: "Jeannot" }, updatedAt: "2026-08-26T11:00:00.000Z" });
  });

  it("does not retrieve or update another tenant's owner", async () => {
    const repository = new MemoryOwnerRepository(); repository.values.set(`${TENANT_A}:${OWNER_ID}`, individual());
    const authority = { ...AUTHORITY, tenantIds: [TENANT_B] };
    await expect(new RetrievePropertyOwner(repository).execute({ authority, ownerId: OWNER_ID })).rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
    await expect(new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" }).execute({
      authority, correlationId: OWNER_ID, ownerId: OWNER_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Other", lastName: "Tenant" }, contactInformation: {},
    })).rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
  });

  it("requires the operation-specific grant", async () => {
    const create = new CreatePropertyOwner(new MemoryOwnerRepository(), { generate: () => OWNER_ID }, { now: () => "2026-08-26T10:00:00.000Z" });
    await expect(create.execute({ authority: { ...AUTHORITY, grants: [] }, correlationId: OWNER_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi" }, contactInformation: {} }))
      .rejects.toMatchObject({ code: "PROPERTY_FORBIDDEN" });
  });

  it("surfaces domain validation rather than persisting invalid input", async () => {
    const create = new CreatePropertyOwner(new MemoryOwnerRepository(), { generate: () => OWNER_ID }, { now: () => "2026-08-26T10:00:00.000Z" });
    await expect(create.execute({ authority: AUTHORITY, correlationId: OWNER_ID,
      identity: { ownerType: "INDIVIDUAL", firstName: "", lastName: "Kouassi" }, contactInformation: {} }))
      .rejects.toBeInstanceOf(InvalidPropertyOwnerInputError);
  });
});
