import { afterEach, describe, expect, it } from "vitest";
import {
  CreatePropertyOwner, PropertyOwner, RetrievePropertyOwner, UpdatePropertyOwner,
  type PropertyOwnerRepository,
} from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyOwnerResponseSchema } from "../../apps/api/src/contracts/v1/properties/property-owner.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

class MemoryOwnerRepository implements PropertyOwnerRepository {
  readonly values = new Map<string, PropertyOwner>();
  async save(owner: PropertyOwner) { this.values.set(`${owner.values.tenantId}:${owner.values.ownerId}`, owner); }
  async findById(tenantId: string, ownerId: string) { return this.values.get(`${tenantId}:${ownerId}`); }
  async updateAtomically(tenantId: string, ownerId: string, update: (owner: PropertyOwner) => PropertyOwner) {
    const key = `${tenantId}:${ownerId}`; const owner = this.values.get(key); if (owner === undefined) return undefined;
    const updated = update(owner); this.values.set(key, updated); return updated;
  }
}

describe("PropertyOwner HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const repository = new MemoryOwnerRepository();

  async function start(options: { tenantId?: string | null; grants?: readonly ("CREATE_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNER" | "UPDATE_PROPERTY_OWNER")[]; failCreate?: boolean } = {}) {
    const tenantId = options.tenantId === undefined ? TENANT_A : options.tenantId;
    const grants = options.grants ?? ["CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "UPDATE_PROPERTY_OWNER"];
    const create = options.failCreate
      ? { execute: async () => { throw new Error("SQL internal-detail-must-not-leak"); } }
      : new CreatePropertyOwner(repository, { generate: () => OWNER_ID }, { now: () => "2026-08-26T10:00:00.000Z" });
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({ actorId: "actor", authorityId: "authority", grants, tenantIds: [tenantId] }) },
      createPropertyOwner: create,
      retrievePropertyOwner: new RetrievePropertyOwner(repository),
      updatePropertyOwner: new UpdatePropertyOwner(repository, { now: () => "2026-08-26T11:00:00.000Z" }),
    });
    await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function stop() { await application?.close(); application = undefined; }
  afterEach(async () => { await stop(); repository.values.clear(); });

  const individual = { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi", phoneNumber: "+2250700000000", email: "jean.kouassi@example.com" };
  const legalEntity = { ownerType: "LEGAL_ENTITY", legalName: "Immobilière Plateau SA", registrationNumber: "CI-ABJ-2026-B-00000", email: "contact@example.com" };
  const post = (body: unknown = individual) => fetch(`${baseUrl}/v1/property-owners`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const put = (body: unknown) => fetch(`${baseUrl}/v1/property-owners/${OWNER_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it.each([individual, legalEntity] as const)("creates and retrieves $ownerType", async (payload) => {
    await start(); const created = await post(payload); expect(created.status).toBe(201);
    expect(PropertyOwnerResponseSchema.parse(await created.json())).toMatchObject({ ownerId: OWNER_ID, ...payload });
    const retrieved = await fetch(`${baseUrl}/v1/property-owners/${OWNER_ID}`); expect(retrieved.status).toBe(200);
    expect(PropertyOwnerResponseSchema.parse(await retrieved.json())).toMatchObject({ ownerId: OWNER_ID, ownerType: payload.ownerType });
  });

  it("updates mutable owner information", async () => {
    await start(); await post();
    const updated = await put({ ...individual, firstName: "Jeannot", email: "new@example.com" });
    expect(updated.status).toBe(200);
    expect(PropertyOwnerResponseSchema.parse(await updated.json())).toMatchObject({ ownerId: OWNER_ID, ownerType: "INDIVIDUAL", firstName: "Jeannot", email: "new@example.com" });
  });

  it("rejects an owner type change", async () => {
    await start(); await post(); const response = await put(legalEntity); expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PROPERTY_OWNER_TYPE_CHANGE_NOT_ALLOWED");
  });

  it.each(["POST", "GET", "PUT"])("requires authentication for %s", async (method) => {
    await start({ tenantId: null });
    const response = method === "POST" ? await post() : method === "PUT" ? await put(individual) : await fetch(`${baseUrl}/v1/property-owners/${OWNER_ID}`);
    expect(response.status).toBe(401); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["POST", ["RETRIEVE_PROPERTY_OWNER", "UPDATE_PROPERTY_OWNER"]],
    ["GET", ["CREATE_PROPERTY_OWNER", "UPDATE_PROPERTY_OWNER"]],
    ["PUT", ["CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER"]],
  ] as const)("requires the operation-specific grant for %s", async (method, grants) => {
    await start({ grants });
    const response = method === "POST" ? await post() : method === "PUT" ? await put(individual) : await fetch(`${baseUrl}/v1/property-owners/${OWNER_ID}`);
    expect(response.status).toBe(403); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("FORBIDDEN");
  });

  it("uses identical 404 semantics for missing and cross-tenant owners", async () => {
    await start(); await post(); await stop(); await start({ tenantId: TENANT_B });
    for (const response of [await fetch(`${baseUrl}/v1/property-owners/${OWNER_ID}`), await put(individual)]) {
      expect(response.status).toBe(404); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PROPERTY_OWNER_NOT_FOUND");
    }
  });

  it.each([
    { ...individual, firstName: " " },
    { ...individual, email: "invalid" },
    { ...individual, legalName: "forbidden" },
    { ...legalEntity, firstName: "forbidden" },
    { ...individual, tenantId: TENANT_A },
    { ownerType: "UNKNOWN", firstName: "Jean", lastName: "Kouassi" },
  ])("rejects invalid or incoherent payload %#", async (payload) => {
    await start(); const response = await post(payload); expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("returns a safe 500 without internal persistence details", async () => {
    await start({ failCreate: true }); const response = await post(); expect(response.status).toBe(500);
    const text = JSON.stringify(ProblemDetailsSchema.parse(await response.json()));
    expect(text).toContain("INTERNAL_ERROR"); expect(text).not.toContain("password"); expect(text).not.toContain("SQL");
  });
});
