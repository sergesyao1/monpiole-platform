import { request } from "node:http";

import { afterEach, describe, expect, it } from "vitest";
import {
  CreateProperty, ListPublicProperties, Property, PublishProperty, RetrieveProperty,
  RetrievePublicPrimaryPhoto, RetrievePublicProperty, RetrievePublicPropertyMedia, UpdatePropertyCoreInformation,
  UpdatePropertyDetails, WithdrawPropertyFromCatalog,
  type PropertyRepository, type PublicPropertyCatalogItem, type PublicPropertyCatalogQuery,
} from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyResponseSchema } from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { PublicPropertyCatalogResponseSchema, PublicPropertyDetailSchema } from "../../apps/api/src/contracts/v1/public-properties/public-property.schema.js";
import { AllowlistedPublicCatalogTenantResolver } from "../../apps/api/src/configuration/public-catalog.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRIMARY_PHOTO = { photoId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", tenantId: TENANT_A, propertyId: PROPERTY_ID,
  mediaKind: "IMAGE" as const, position: 0,
  category: "BUILDING_EXTERIOR_OR_ENTRANCE" as const, status: "AVAILABLE" as const,
  contentType: "image/png" as const, contentByteSize: 8,
  contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
  isPrimary: true, registeredAt: "2026-08-25T12:30:00.000Z", availableAt: "2026-08-25T12:31:00.000Z" };
const STUDIO_PHOTOS = [
  PRIMARY_PHOTO,
  { ...PRIMARY_PHOTO, photoId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", category: "MAIN_LIVING_SLEEPING_AREA" as const, isPrimary: false, position: 1 },
  { ...PRIMARY_PHOTO, photoId: "ffffffff-ffff-4fff-8fff-ffffffffffff", category: "KITCHEN_OR_KITCHENETTE" as const, isPrimary: false, position: 2 },
  { ...PRIMARY_PHOTO, photoId: "11111111-1111-4111-8111-111111111111", category: "BATHROOM_OR_SHOWER_ROOM" as const, isPrimary: false, position: 3 },
  { ...PRIMARY_PHOTO, photoId: "22222222-2222-4222-8222-222222222222", category: "OTHER" as const, isPrimary: false, position: 4 },
  { ...PRIMARY_PHOTO, photoId: "33333333-3333-4333-8333-333333333333", category: "OTHER" as const, isPrimary: false, position: 5 },
];
class MemoryRepository implements PropertyRepository {
  values = new Map<string, Property>(); async saveStandalone(p: Property) { this.values.set(`${p.values.tenantId}:${p.values.propertyId}`, p); }
  async findById(t: string, p: string) { return this.values.get(`${t}:${p}`); }
  async updateAtomically(t: string, p: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    const key = `${t}:${p}`; const property = this.values.get(key); if (property === undefined) return undefined;
    const updated = update(property, property.values.photos ?? []); if (updated === property) return property; this.values.set(key, updated); return updated;
  }
}
class MemoryPublicPropertyCatalog implements PublicPropertyCatalogQuery {
  constructor(private readonly repository: MemoryRepository) {}

  async list(criteria: Parameters<PublicPropertyCatalogQuery["list"]>[0]) {
    const property = this.repository.values.get(`${criteria.tenantId}:${PROPERTY_ID}`);
    const item = property === undefined ? undefined : toPublicItem(property);
    if (item === undefined || (criteria.propertyType !== undefined && item.propertyType !== criteria.propertyType)
      || (criteria.transactionType !== undefined && item.transactionType !== criteria.transactionType)
      || criteria.cursor !== undefined) return { items: [] };
    return { items: [item] };
  }

  async retrieve(tenantId: string, publicPropertyId: string) {
    const property = this.repository.values.get(`${tenantId}:${publicPropertyId}`);
    if (property === undefined) return undefined;
    const item = toPublicItem(property);
    if (item === undefined) return undefined;
    return {
      ...item, description: property.values.description ?? null, details: property.values.details ?? {},
      gallery: (property.values.photos ?? []).map((photo) => ({
        mediaId: photo.photoId, kind: photo.mediaKind, category: photo.category,
        position: photo.position, isPrimary: photo.isPrimary, contentType: photo.contentType,
      })),
    };
  }

  async retrievePrimaryPhoto(tenantId: string, publicPropertyId: string) {
    const property = this.repository.values.get(`${tenantId}:${publicPropertyId}`);
    const item = property === undefined ? undefined : toPublicItem(property);
    if (item?.primaryPhoto === null || item === undefined) return undefined;
    return {
      content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      contentType: item.primaryPhoto.contentType,
      contentByteSize: 8,
      contentSha256: PRIMARY_PHOTO.contentSha256,
    };
  }
  async retrieveMedia(tenantId: string, publicPropertyId: string, mediaId: string) {
    const property = this.repository.values.get(`${tenantId}:${publicPropertyId}`);
    const media = property?.values.photos?.find((photo) => photo.photoId === mediaId);
    if (property?.values.status !== "PUBLISHED" || media === undefined) return undefined;
    return {
      content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), contentType: media.contentType,
      contentByteSize: media.contentByteSize, contentSha256: media.contentSha256,
    };
  }
}

function toPublicItem(property: Property): PublicPropertyCatalogItem | undefined {
  const value = property.values;
  if (value.status !== "PUBLISHED" || value.publishedAt === undefined || value.commercialTerms === undefined) return undefined;
  const primaryPhoto = value.photos?.find((photo) => photo.isPrimary);
  return {
    publicPropertyId: value.propertyId,
    title: value.title,
    propertyType: value.propertyType,
    transactionType: value.transactionType,
    ...(value.apartmentSubtype === undefined ? {} : { apartmentSubtype: value.apartmentSubtype }),
    structuralRole: value.structuralRole,
    location: { country: value.location.country, city: value.location.city, district: value.location.district },
    commercialTerms: value.commercialTerms,
    primaryPhoto: primaryPhoto === undefined ? null : { contentType: primaryPhoto.contentType },
    publishedAt: value.publishedAt,
  };
}
describe("Property HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined; let baseUrl = ""; const repository = new MemoryRepository();
  async function start(
    tenantId: string | null = TENANT_A,
    allowUpdate = true,
    allowPublish = true,
    publishOverride?: { execute: PublishProperty["execute"] },
    allowWithdraw = true,
    withdrawOverride?: { execute: WithdrawPropertyFromCatalog["execute"] },
  ) {
    const publicCatalog = new MemoryPublicPropertyCatalog(repository);
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({ actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY", ...(allowUpdate ? ["UPDATE_PROPERTY_DETAILS" as const, "UPDATE_PROPERTY_CORE_INFORMATION" as const] : []), ...(allowPublish ? ["PUBLISH_PROPERTY" as const] : []), ...(allowWithdraw ? ["WITHDRAW_PROPERTY_FROM_CATALOG" as const] : [])], tenantIds: [tenantId] }) },
      createProperty: new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }), retrieveProperty: new RetrieveProperty(repository),
      updatePropertyDetails: new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" }),
      updatePropertyCoreInformation: new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" }),
      publishProperty: publishOverride ?? new PublishProperty(repository, { now: () => "2026-08-25T16:00:00.000Z" }),
      withdrawPropertyFromCatalog: withdrawOverride ?? new WithdrawPropertyFromCatalog(repository, { now: () => "2026-08-25T17:00:00.000Z" }),
      publicCatalogTenantResolver: new AllowlistedPublicCatalogTenantResolver(new Map([["catalogue.test", TENANT_A]])),
      listPublicProperties: new ListPublicProperties(publicCatalog),
      retrievePublicProperty: new RetrievePublicProperty(publicCatalog),
      retrievePublicPrimaryPhoto: new RetrievePublicPrimaryPhoto(publicCatalog),
      retrievePublicPropertyMedia: new RetrievePublicPropertyMedia(publicCatalog),
    }); await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind"); baseUrl = `http://127.0.0.1:${address.port}`;
  }
  async function stop() { await application?.close(); application = undefined; }
  afterEach(async () => { await application?.close(); application = undefined; repository.values.clear(); });
  const body = { title: "Apartment", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" } };
  const post = (value: unknown = body) => fetch(`${baseUrl}/v1/properties`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  const putDetails = () => fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
    details: { rooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" },
  }) });
  const publish = (propertyId = PROPERTY_ID) => fetch(`${baseUrl}/v1/properties/${propertyId}/publication`, { method: "PUT" });
  const withdraw = (propertyId = PROPERTY_ID, init: RequestInit = {}) => fetch(`${baseUrl}/v1/properties/${propertyId}/publication`, { ...init, method: "DELETE" });
  const requestPublic = (path: string, headers: Readonly<Record<string, string>> = {}) => new Promise<Response>((resolve, reject) => {
    const outgoing = request(`${baseUrl}${path}`, { headers: { host: "catalogue.test", ...headers } }, (incoming) => {
      const chunks: Uint8Array[] = [];
      incoming.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
          else if (value !== undefined) responseHeaders.set(name, value);
        }
        const status = incoming.statusCode ?? 500;
        resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, headers: responseHeaders }));
      });
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
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
  it("withdraws with a bodyless DELETE and returns the canonical WITHDRAWN representation on first call and replay", async () => {
    await start(); await post(); await putDetails(); seedPrimaryPhoto(); await publish();
    const first = await withdraw();
    expect(first.status).toBe(200);
    expect(first.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(PropertyResponseSchema.parse(await first.json())).toMatchObject({
      propertyId: PROPERTY_ID, status: "WITHDRAWN", publishedAt: "2026-08-25T16:00:00.000Z",
      withdrawnAt: "2026-08-25T17:00:00.000Z", updatedAt: "2026-08-25T17:00:00.000Z",
      canWithdrawFromCatalog: false, details: { rooms: 2 },
    });
    const replay = await withdraw();
    expect(replay.status).toBe(200);
    expect(PropertyResponseSchema.parse(await replay.json())).toMatchObject({
      status: "WITHDRAWN", withdrawnAt: "2026-08-25T17:00:00.000Z", canWithdrawFromCatalog: false,
    });
    const retrieved = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`);
    expect(PropertyResponseSchema.parse(await retrieved.json())).toMatchObject({ status: "WITHDRAWN", details: { rooms: 2 } });
  });
  it("returns stable withdrawal lifecycle conflicts and rejects republication", async () => {
    await start(); await post();
    const draftWithdrawal = await withdraw();
    expect(draftWithdrawal.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await draftWithdrawal.json())).toMatchObject({ code: "PROPERTY_NOT_PUBLISHED", status: 409 });
    await putDetails(); seedPrimaryPhoto(); await publish(); await withdraw();
    const republication = await publish();
    expect(republication.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await republication.json())).toMatchObject({ code: "PROPERTY_REPUBLICATION_NOT_SUPPORTED", status: 409 });
  });
  it("authenticates, authorizes, validates and tenant-scopes catalog withdrawal", async () => {
    await start(TENANT_A); await post(); await putDetails(); seedPrimaryPhoto(); await publish(); await stop();
    await start(null); expect((await withdraw()).status).toBe(401); await stop();
    await start(TENANT_A, true, true, undefined, false); expect((await withdraw()).status).toBe(403); await stop();
    await start(TENANT_B); expect((await withdraw()).status).toBe(404); await stop();
    await start(TENANT_A); expect((await withdraw("not-a-uuid")).status).toBe(400);
    expect((await withdraw("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).status).toBe(404);
  });
  it("exposes the withdrawal affordance only for a published Property and matching authority", async () => {
    await start(); await post(); await putDetails(); seedPrimaryPhoto(); await publish();
    const allowed = PropertyResponseSchema.parse(await (await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`)).json());
    expect(allowed).toMatchObject({ status: "PUBLISHED", canWithdrawFromCatalog: true });
    await stop(); await start(TENANT_A, true, true, undefined, false);
    const denied = PropertyResponseSchema.parse(await (await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`)).json());
    expect(denied).toMatchObject({ status: "PUBLISHED", canWithdrawFromCatalog: false });
  });
  it("maps an unexpected withdrawal failure to a safe 500", async () => {
    await start(TENANT_A, true, true, undefined, true, { execute: async () => { throw new Error("sensitive withdrawal failure"); } });
    const response = await withdraw();
    expect(response.status).toBe(500);
    const problem = ProblemDetailsSchema.parse(await response.json());
    expect(problem).toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
    expect(JSON.stringify(problem)).not.toContain("sensitive withdrawal failure");
  });
  it("removes a withdrawn Property from every public HTTP surface while preserving its private detail", async () => {
    await start(); await post(); await putDetails(); seedPrimaryPhoto(); await publish();
    const visiblePage = await requestPublic("/v1/public/properties");
    expect(visiblePage.status).toBe(200);
    expect(PublicPropertyCatalogResponseSchema.parse(await visiblePage.json()).items).toEqual([
      expect.objectContaining({ publicPropertyId: PROPERTY_ID }),
    ]);
    const visibleDetail = await requestPublic(`/v1/public/properties/${PROPERTY_ID}`);
    expect(visibleDetail.status).toBe(200);
    expect(PublicPropertyDetailSchema.parse(await visibleDetail.json())).toMatchObject({ publicPropertyId: PROPERTY_ID });
    const visiblePhoto = await requestPublic(`/v1/public/properties/${PROPERTY_ID}/primary-photo`);
    expect(visiblePhoto.status).toBe(200);
    const etag = visiblePhoto.headers.get("etag");
    expect(etag).toBe(`"${PRIMARY_PHOTO.contentSha256}"`);

    expect((await withdraw()).status).toBe(200);

    const hiddenPage = await requestPublic("/v1/public/properties");
    expect(PublicPropertyCatalogResponseSchema.parse(await hiddenPage.json()).items).toEqual([]);
    const hiddenDetail = await requestPublic(`/v1/public/properties/${PROPERTY_ID}`);
    expect(hiddenDetail.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await hiddenDetail.json())).toMatchObject({ code: "PUBLIC_PROPERTY_NOT_FOUND" });
    const hiddenPhoto = await requestPublic(`/v1/public/properties/${PROPERTY_ID}/primary-photo`, { "if-none-match": etag! });
    expect(hiddenPhoto.status).toBe(404);
    expect(hiddenPhoto.headers.get("cache-control")).toBe("no-store");
    const privateDetail = PropertyResponseSchema.parse(await (await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}`)).json());
    expect(privateDetail).toMatchObject({ status: "WITHDRAWN", propertyId: PROPERTY_ID, details: { rooms: 2 } });
  });
});
