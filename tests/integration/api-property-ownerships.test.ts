import { afterEach, describe, expect, it } from "vitest";
import {
  AssignPropertyOwner, PropertyOwnership, RemovePropertyOwner, RetrievePropertyOwnerships,
  assertOwnershipShareCapacity, type PropertyOwnershipRepository,
} from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { PropertyOwnershipListResponseSchema, PropertyOwnershipResponseSchema } from "../../apps/api/src/contracts/v1/properties/property-ownership.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OWNER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

class MemoryOwnershipRepository implements PropertyOwnershipRepository {
  readonly properties = new Set([`${TENANT_A}:${PROPERTY_ID}`]);
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

describe("PropertyOwnership HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = ""; const repository = new MemoryOwnershipRepository();
  async function start(tenantId: string | null = TENANT_A, grants: readonly ("ASSIGN_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNERSHIP" | "REMOVE_PROPERTY_OWNER")[] = ["ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER"]) {
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({ actorId: "actor", authorityId: "authority", grants, tenantIds: [tenantId] }) },
      assignPropertyOwner: new AssignPropertyOwner(repository, { now: () => "2026-08-26T12:00:00.000Z" }),
      retrievePropertyOwnerships: new RetrievePropertyOwnerships(repository), removePropertyOwner: new RemovePropertyOwner(repository),
    });
    await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind"); baseUrl = `http://127.0.0.1:${address.port}`;
  }
  afterEach(async () => { await application?.close(); application = undefined; repository.values.clear(); });
  const post = (ownerId: string = OWNER_A, ownershipShare = 60) => fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/owners`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId, ownershipShare }),
  });
  const get = () => fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/owners`);
  const remove = (ownerId: string = OWNER_A) => fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/owners/${ownerId}`, { method: "DELETE" });

  it("assigns, lists and removes property owners", async () => {
    await start(); const assigned = await post(); expect(assigned.status).toBe(201);
    expect(PropertyOwnershipResponseSchema.parse(await assigned.json())).toMatchObject({ propertyId: PROPERTY_ID, ownerId: OWNER_A, ownershipShare: 60 });
    expect((await post(OWNER_B, 40)).status).toBe(201);
    const listed = await get(); expect(listed.status).toBe(200); expect(PropertyOwnershipListResponseSchema.parse(await listed.json())).toHaveLength(2);
    expect((await remove()).status).toBe(204);
    expect(PropertyOwnershipListResponseSchema.parse(await (await get()).json())).toEqual([expect.objectContaining({ ownerId: OWNER_B })]);
  });

  it.each([0, -1, 100.01, 33.333])("rejects invalid share %s", async (ownershipShare) => {
    await start(); const response = await post(OWNER_A, ownershipShare); expect(response.status).toBe(400);
  });

  it("returns conflicts for duplicate and exceeded totals", async () => {
    await start(); await post();
    const duplicate = await post(); expect(duplicate.status).toBe(409); expect(ProblemDetailsSchema.parse(await duplicate.json()).code).toBe("PROPERTY_OWNERSHIP_CONFLICT");
    const exceeded = await post(OWNER_B, 40.01); expect(exceeded.status).toBe(409); expect(ProblemDetailsSchema.parse(await exceeded.json()).code).toBe("PROPERTY_OWNERSHIP_SHARE_EXCEEDED");
  });

  it("returns safe 404 for missing references, relations and cross-tenant access", async () => {
    await start(); expect((await post("ffffffff-ffff-4fff-8fff-ffffffffffff", 10)).status).toBe(404);
    expect((await remove()).status).toBe(404); await application?.close(); application = undefined; await start(TENANT_B);
    expect((await get()).status).toBe(404); expect((await post()).status).toBe(404); expect((await remove()).status).toBe(404);
  });

  it.each(["POST", "GET", "DELETE"])("requires authentication for %s", async (method) => {
    await start(null); const response = method === "POST" ? await post() : method === "GET" ? await get() : await remove(); expect(response.status).toBe(401);
  });

  it.each([
    ["POST", ["RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER"]],
    ["GET", ["ASSIGN_PROPERTY_OWNER", "REMOVE_PROPERTY_OWNER"]],
    ["DELETE", ["ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP"]],
  ] as const)("requires the operation grant for %s", async (method, grants) => {
    await start(TENANT_A, grants); const response = method === "POST" ? await post() : method === "GET" ? await get() : await remove(); expect(response.status).toBe(403);
  });
});
