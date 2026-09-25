import { describe, expect, it } from "vitest";
import {
  AssignPropertyOwner, InvalidPropertyOwnershipInputError, PropertyNotFoundError,
  PropertyOwnerNotFoundError, PropertyOwnership, PropertyOwnershipConflictError,
  PropertyOwnershipNotFoundError, PropertyOwnershipShareExceededError,
  RemovePropertyOwner, RetrievePropertyOwnerships, assertOwnershipShareCapacity,
  type PropertyAuthority, type PropertyOwnershipRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROPERTY_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OWNER_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OWNER_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CORRELATION = "11111111-1111-4111-8111-111111111111";
const AUTHORITY: PropertyAuthority = {
  actorId: "actor", authorityId: "authority",
  grants: ["ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER"], tenantIds: [TENANT_A],
};

function ownership(ownershipShare = 60, propertyId = PROPERTY_A, ownerId = OWNER_A, tenantId = TENANT_A) {
  return PropertyOwnership.create({
    tenantId, propertyId, ownerId, ownershipShare,
    createdAt: "2026-08-26T12:00:00.000Z", correlationId: CORRELATION, actorId: "actor",
  });
}

class MemoryOwnershipRepository implements PropertyOwnershipRepository {
  readonly properties = new Set([`${TENANT_A}:${PROPERTY_A}`, `${TENANT_A}:${PROPERTY_B}`]);
  readonly owners = new Set([`${TENANT_A}:${OWNER_A}`, `${TENANT_A}:${OWNER_B}`]);
  readonly values = new Map<string, PropertyOwnership>();
  async assignAtomically(value: PropertyOwnership) {
    const { tenantId, propertyId, ownerId, ownershipShare } = value.values;
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return "PROPERTY_NOT_FOUND" as const;
    if (!this.owners.has(`${tenantId}:${ownerId}`)) return "OWNER_NOT_FOUND" as const;
    const key = `${tenantId}:${propertyId}:${ownerId}`; if (this.values.has(key)) return "DUPLICATE" as const;
    assertOwnershipShareCapacity([...this.values.values()].filter((item) => item.values.tenantId === tenantId && item.values.propertyId === propertyId)
      .map((item) => item.values.ownershipShare), ownershipShare);
    this.values.set(key, value); return "ASSIGNED" as const;
  }
  async listByProperty(tenantId: string, propertyId: string) {
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return undefined;
    return [...this.values.values()].filter((item) => item.values.tenantId === tenantId && item.values.propertyId === propertyId);
  }
  async removeAtomically(tenantId: string, propertyId: string, ownerId: string) {
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return "PROPERTY_NOT_FOUND" as const;
    return this.values.delete(`${tenantId}:${propertyId}:${ownerId}`) ? "REMOVED" as const : "OWNERSHIP_NOT_FOUND" as const;
  }
}

describe("PropertyOwnership domain", () => {
  it.each([0.01, 60, 100])("accepts a valid ownership share %s", (ownershipShare) => {
    expect(ownership(ownershipShare).values.ownershipShare).toBe(ownershipShare);
  });
  it.each([0, -1, 100.01, 33.333, Number.NaN])("rejects invalid ownership share %s", (ownershipShare) => {
    expect(() => ownership(ownershipShare)).toThrow(InvalidPropertyOwnershipInputError);
  });
  it("allows partial totals and rejects totals above 100", () => {
    expect(() => assertOwnershipShareCapacity([40], 50)).not.toThrow();
    expect(() => assertOwnershipShareCapacity([60], 40)).not.toThrow();
    expect(() => assertOwnershipShareCapacity([60], 40.01)).toThrow(PropertyOwnershipShareExceededError);
  });
  it("uses the natural composite identity without an ownershipId", () => {
    expect(ownership().values).toMatchObject({ tenantId: TENANT_A, propertyId: PROPERTY_A, ownerId: OWNER_A });
    expect(ownership().values).not.toHaveProperty("ownershipId");
  });
});

describe("PropertyOwnership application operations", () => {
  const assign = (repository: MemoryOwnershipRepository) => new AssignPropertyOwner(repository, { now: () => "2026-08-26T12:00:00.000Z" });
  const command = { authority: AUTHORITY, correlationId: CORRELATION, propertyId: PROPERTY_A, ownerId: OWNER_A, ownershipShare: 60 };

  it("assigns multiple owners to one property and one owner to multiple properties", async () => {
    const repository = new MemoryOwnershipRepository(); const useCase = assign(repository);
    await useCase.execute(command);
    await useCase.execute({ ...command, ownerId: OWNER_B, ownershipShare: 40 });
    await useCase.execute({ ...command, propertyId: PROPERTY_B, ownershipShare: 25 });
    expect(await new RetrievePropertyOwnerships(repository).execute({ authority: AUTHORITY, propertyId: PROPERTY_A })).toHaveLength(2);
    expect(repository.values.size).toBe(3);
  });

  it("distinguishes missing property, owner, duplicate and exceeded total", async () => {
    const repository = new MemoryOwnershipRepository(); const useCase = assign(repository);
    await expect(useCase.execute({ ...command, propertyId: "22222222-2222-4222-8222-222222222222" })).rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(useCase.execute({ ...command, ownerId: "33333333-3333-4333-8333-333333333333" })).rejects.toBeInstanceOf(PropertyOwnerNotFoundError);
    await useCase.execute(command);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(PropertyOwnershipConflictError);
    await expect(useCase.execute({ ...command, ownerId: OWNER_B, ownershipShare: 40.01 })).rejects.toBeInstanceOf(PropertyOwnershipShareExceededError);
  });

  it("removes only the relation and reports a missing relation", async () => {
    const repository = new MemoryOwnershipRepository(); await assign(repository).execute(command);
    const remove = new RemovePropertyOwner(repository); await remove.execute({ authority: AUTHORITY, propertyId: PROPERTY_A, ownerId: OWNER_A });
    expect(repository.properties.has(`${TENANT_A}:${PROPERTY_A}`)).toBe(true);
    expect(repository.owners.has(`${TENANT_A}:${OWNER_A}`)).toBe(true);
    await expect(remove.execute({ authority: AUTHORITY, propertyId: PROPERTY_A, ownerId: OWNER_A }))
      .rejects.toBeInstanceOf(PropertyOwnershipNotFoundError);
  });

  it("preserves tenant isolation and operation-specific grants", async () => {
    const repository = new MemoryOwnershipRepository(); const useCase = assign(repository);
    await expect(useCase.execute({ ...command, authority: { ...AUTHORITY, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(useCase.execute({ ...command, authority: { ...AUTHORITY, grants: [] } })).rejects.toMatchObject({ code: "PROPERTY_FORBIDDEN" });
  });
});
