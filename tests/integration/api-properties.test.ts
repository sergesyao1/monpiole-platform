import { afterEach, describe, expect, it } from "vitest";
import { CreateProperty, Property, RetrieveProperty, type PropertyRepository } from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyResponseSchema } from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
class MemoryRepository implements PropertyRepository {
  values = new Map<string, Property>(); async save(p: Property) { this.values.set(`${p.values.tenantId}:${p.values.propertyId}`, p); }
  async findById(t: string, p: string) { return this.values.get(`${t}:${p}`); }
}
describe("Property HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined; let baseUrl = ""; const repository = new MemoryRepository();
  async function start(tenantId: string | null = TENANT_A) {
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({ actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"], tenantIds: [tenantId] }) },
      createProperty: new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }), retrieveProperty: new RetrieveProperty(repository),
    }); await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind"); baseUrl = `http://127.0.0.1:${address.port}`;
  }
  afterEach(async () => { await application?.close(); application = undefined; repository.values.clear(); });
  const body = { title: "Apartment", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" } };
  const post = (value: unknown = body) => fetch(`${baseUrl}/v1/properties`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  it("creates then retrieves a DRAFT for the authenticated tenant", async () => {
    await start(); const created = await post(); expect(created.status).toBe(201); expect(PropertyResponseSchema.parse(await created.json())).toMatchObject({ propertyId: PROPERTY_ID, status: "DRAFT" });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`); expect(retrieved.status).toBe(200); expect(PropertyResponseSchema.parse(await retrieved.json()).propertyId).toBe(PROPERTY_ID);
  });
  it.each(["POST", "GET"])("requires authentication for %s", async (method) => {
    await start(null); const response = method === "POST" ? await post() : await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`);
    expect(response.status).toBe(401); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("UNAUTHORIZED");
  });
  it("returns 404 without disclosure across tenants", async () => {
    await start(TENANT_A); await post(); await application?.close(); application = undefined; await start(TENANT_B);
    const response = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`); expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PROPERTY_NOT_FOUND");
  });
  it.each(["tenantId", "status", "propertyId"])("rejects caller-controlled %s", async (field) => {
    await start(); const response = await post({ ...body, [field]: field === "status" ? "PUBLISHED" : PROPERTY_ID }); expect(response.status).toBe(400);
  });
  it("rejects an invalid property identifier", async () => { await start(); expect((await fetch(`${baseUrl}/v1/properties/not-a-uuid`)).status).toBe(400); });
});
