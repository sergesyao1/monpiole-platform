import { afterEach, describe, expect, it } from "vitest";
import { CreateProperty, Property, PublishProperty, RetrieveProperty, UpdatePropertyCoreInformation, UpdatePropertyDetails, type PropertyRepository } from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyResponseSchema } from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRIMARY_PHOTO = { photoId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", tenantId: TENANT_A, propertyId: PROPERTY_ID,
  category: "BUILDING_EXTERIOR_OR_ENTRANCE" as const, status: "AVAILABLE" as const,
  contentType: "image/png" as const, contentByteSize: 8,
  contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
  isPrimary: true, registeredAt: "2026-08-25T12:30:00.000Z", availableAt: "2026-08-25T12:31:00.000Z" };
const STUDIO_PHOTOS = [
  PRIMARY_PHOTO,
  { ...PRIMARY_PHOTO, photoId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", category: "MAIN_LIVING_SLEEPING_AREA" as const, isPrimary: false },
  { ...PRIMARY_PHOTO, photoId: "ffffffff-ffff-4fff-8fff-ffffffffffff", category: "KITCHEN_OR_KITCHENETTE" as const, isPrimary: false },
  { ...PRIMARY_PHOTO, photoId: "11111111-1111-4111-8111-111111111111", category: "BATHROOM_OR_SHOWER_ROOM" as const, isPrimary: false },
  { ...PRIMARY_PHOTO, photoId: "22222222-2222-4222-8222-222222222222", category: "OTHER" as const, isPrimary: false },
  { ...PRIMARY_PHOTO, photoId: "33333333-3333-4333-8333-333333333333", category: "OTHER" as const, isPrimary: false },
];
class MemoryRepository implements PropertyRepository {
  values = new Map<string, Property>(); async saveStandalone(p: Property) { this.values.set(`${p.values.tenantId}:${p.values.propertyId}`, p); }
  async findById(t: string, p: string) { return this.values.get(`${t}:${p}`); }
  async updateAtomically(t: string, p: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    const key = `${t}:${p}`; const property = this.values.get(key); if (property === undefined) return undefined;
    const updated = update(property, property.values.photos ?? []); if (updated === property) return property; this.values.set(key, updated); return updated;
  }
}
describe("Property HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined; let baseUrl = ""; const repository = new MemoryRepository();
  async function start(tenantId: string | null = TENANT_A, allowUpdate = true, allowPublish = true, publishOverride?: { execute: PublishProperty["execute"] }) {
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({ actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY", ...(allowUpdate ? ["UPDATE_PROPERTY_DETAILS" as const, "UPDATE_PROPERTY_CORE_INFORMATION" as const] : []), ...(allowPublish ? ["PUBLISH_PROPERTY" as const] : [])], tenantIds: [tenantId] }) },
      createProperty: new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }), retrieveProperty: new RetrieveProperty(repository),
      updatePropertyDetails: new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" }),
      updatePropertyCoreInformation: new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" }),
      publishProperty: publishOverride ?? new PublishProperty(repository, { now: () => "2026-08-25T16:00:00.000Z" }),
    }); await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind"); baseUrl = `http://127.0.0.1:${address.port}`;
  }
  async function stop() { await application?.close(); application = undefined; }
  afterEach(async () => { await application?.close(); application = undefined; repository.values.clear(); });
  const body = { title: "Apartment", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" } };
  const post = (value: unknown = body) => fetch(`${baseUrl}/v1/properties`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  const putDetails = () => fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
    details: { rooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 0, rentPeriod: "MONTH" },
  }) });
  const publish = (propertyId = PROPERTY_ID) => fetch(`${baseUrl}/v1/properties/${propertyId}/publication`, { method: "PUT" });
  const seedPrimaryPhoto = () => {
    const key = `${TENANT_A}:${PROPERTY_ID}`; const property = repository.values.get(key)!;
    repository.values.set(key, Property.rehydrate({ ...property.values, photos: STUDIO_PHOTOS }));
  };
  it("creates then retrieves a DRAFT for the authenticated tenant", async () => {
    await start(); const created = await post(); expect(created.status).toBe(201); expect(PropertyResponseSchema.parse(await created.json())).toMatchObject({ propertyId: PROPERTY_ID, status: "DRAFT" });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`); expect(retrieved.status).toBe(200); expect(PropertyResponseSchema.parse(await retrieved.json()).propertyId).toBe(PROPERTY_ID);
  });
  it.each(["POST", "GET"])("requires authentication for %s", async (method) => {
    await start(null); const response = method === "POST" ? await post() : await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`);
    expect(response.status).toBe(401); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("UNAUTHORIZED");
  });
  it("returns 404 without disclosure across tenants", async () => {
    await start(TENANT_A); await post(); await stop(); await start(TENANT_B);
    const response = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`); expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PROPERTY_NOT_FOUND");
  });
  it.each(["tenantId", "status", "propertyId"])("rejects caller-controlled %s", async (field) => {
    await start(); const response = await post({ ...body, [field]: field === "status" ? "PUBLISHED" : PROPERTY_ID }); expect(response.status).toBe(400);
  });
  it("rejects an invalid property identifier", async () => { await start(); expect((await fetch(`${baseUrl}/v1/properties/not-a-uuid`)).status).toBe(400); });
  it("updates details and terms, then exposes them through retrieval", async () => {
    await start(); await post();
    const response = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
      details: { usableSurfaceSquareMeters: 85, rooms: 4, bedrooms: 2, bathrooms: 1, furnished: true },
      commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 350_000, rentPeriod: "MONTH", chargesAmountMinor: 30_000 },
    }) });
    expect(response.status).toBe(200); expect(PropertyResponseSchema.parse(await response.json())).toMatchObject({ commercialTerms: { kind: "LONG_TERM_RENTAL" } });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`); expect(await retrieved.json()).toMatchObject({ details: { rooms: 4 }, commercialTerms: { rentAmountMinor: 350_000 } });
  });
  it("rejects unauthenticated, incompatible, and cross-tenant updates safely", async () => {
    await start(TENANT_A); await post();
    const payload = { details: { rooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" } };
    const incompatible = { details: { rooms: 2 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 } };
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(incompatible) })).status).toBe(400);
    await stop(); await start(TENANT_B);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(404);
    await stop(); await start(null);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(401);
    await stop(); await start(TENANT_A, false);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(403);
  });
  it("updates core information without changing authoritative property fields", async () => {
    await start(); await post();
    const response = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
      title: "  Villa Lagune  ", description: "  Vue sur la lagune  ",
      location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" },
    }) });
    expect(response.status).toBe(200);
    expect(PropertyResponseSchema.parse(await response.json())).toMatchObject({
      title: "Villa Lagune", description: "Vue sur la lagune", propertyType: "APARTMENT",
      transactionType: "LONG_TERM_RENTAL", status: "DRAFT", location: { district: "Marcory" },
      updatedAt: "2026-08-25T15:00:00.000Z",
    });
  });
  it("validates, authorizes and hides cross-tenant core information updates", async () => {
    const payload = { title: "Villa", location: body.location };
    await start(TENANT_A); await post();
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, propertyType: "HOUSE" }) })).status).toBe(400);
    await stop(); await start(TENANT_B);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(404);
    await stop(); await start(null);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(401);
    await stop(); await start(TENANT_A, false);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(403);
  });
  it("publishes with a bodyless PUT and returns the canonical PUBLISHED representation on first call and replay", async () => {
    await start(); await post(); expect((await putDetails()).status).toBe(200); seedPrimaryPhoto();
    const first = await publish();
    expect(first.status).toBe(200);
    expect(first.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(first.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(PropertyResponseSchema.parse(await first.json())).toMatchObject({
      propertyId: PROPERTY_ID, status: "PUBLISHED", publishedAt: "2026-08-25T16:00:00.000Z", updatedAt: "2026-08-25T16:00:00.000Z",
    });
    const replay = await publish();
    expect(replay.status).toBe(200);
    expect(PropertyResponseSchema.parse(await replay.json())).toMatchObject({ status: "PUBLISHED", publishedAt: "2026-08-25T16:00:00.000Z" });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`);
    expect(PropertyResponseSchema.parse(await retrieved.json())).toMatchObject({ status: "PUBLISHED", publishedAt: "2026-08-25T16:00:00.000Z" });
  });
  it("returns the exact safe publication prerequisites without mutating the DRAFT", async () => {
    await start(); await post();
    const response = await publish();
    expect(response.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await response.json())).toEqual(expect.objectContaining({
      type: "https://api.monpiole.example/problems/property-publication-requirements-not-met",
      title: "Property publication requirements not met", status: 409,
      code: "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
      errors: [
        { path: "property.details", code: "required_for_publication" },
        { path: "property.commercialTerms", code: "required_for_publication" },
        { path: "property.primaryPhoto", code: "required_for_publication" },
        { path: "property.photos", code: "minimum_for_publication" },
        { path: "property.photos", code: "required_views_for_publication" },
      ],
    }));
    expect(repository.values.get(`${TENANT_A}:${PROPERTY_ID}`)?.values.status).toBe("DRAFT");
  });
  it("validates, authenticates, authorizes and tenant-scopes publication", async () => {
    await start(); expect((await publish("not-a-uuid")).status).toBe(400); await stop();
    await start(null); expect((await publish()).status).toBe(401); await stop();
    await start(TENANT_A, true, false); expect((await publish()).status).toBe(403); await stop();
    await start(TENANT_A); await post(); await putDetails(); await stop();
    await start(TENANT_B); expect((await publish()).status).toBe(404);
  });
  it("maps unexpected publication failures to a safe 500", async () => {
    await start(TENANT_A, true, true, { execute: async () => { throw new Error("sensitive database failure"); } });
    const response = await publish();
    expect(response.status).toBe(500);
    const problem = ProblemDetailsSchema.parse(await response.json());
    expect(problem).toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
    expect(JSON.stringify(problem)).not.toContain("sensitive database failure");
  });
});
