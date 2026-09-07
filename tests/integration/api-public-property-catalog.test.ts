import { request } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import {
  publicCatalogHostAllowlistFromEnvironment,
} from "../../apps/api/src/configuration/public-catalog.js";
import {
  encodePublicPropertyCatalogCursor,
} from "../../apps/api/src/http/public-properties/public-property-cursor.js";
import {
  PublicPropertyNotFoundError,
  type PublicPropertyCatalogDetail,
  type PublicPropertyCatalogItem,
} from "../../services/property-management/src/index.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  PublicPropertyCatalogResponseSchema,
  PublicPropertyDetailSchema,
} from "../../apps/api/src/contracts/v1/public-properties/public-property.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_PROPERTY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PUBLISHED_AT = "2026-08-31T10:00:00.000Z";

function summary(): PublicPropertyCatalogItem {
  return {
    publicPropertyId: PROPERTY_ID,
    title: "Maison des Lagunes",
    propertyType: "HOUSE",
    transactionType: "SALE",
    structuralRole: "STANDALONE",
    location: { country: "CI", city: "Abidjan", district: "Cocody" },
    commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 },
    primaryPhoto: { contentType: "image/png" },
    publishedAt: PUBLISHED_AT,
  };
}

function detail(): PublicPropertyCatalogDetail {
  return { ...summary(), description: "Vue sur la lagune", details: { rooms: 5, bedrooms: 3, bathrooms: 2 } };
}

describe("public Property catalog HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  async function start(overrides: Readonly<Record<string, unknown>> = {}) {
    const allowlist = publicCatalogHostAllowlistFromEnvironment({
      PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST: `catalogue.test=${TENANT_A},autre.test=${TENANT_B}`,
      NODE_ENV: "test",
    });
    const listPublicProperties = { execute: vi.fn(async () => ({
      items: [summary()],
      nextCursor: { publishedAt: PUBLISHED_AT, publicPropertyId: PROPERTY_ID },
    })) };
    const retrievePublicProperty = { execute: vi.fn(async ({ publicPropertyId }: { publicPropertyId: string }) => {
      if (publicPropertyId === OTHER_PROPERTY_ID) throw new PublicPropertyNotFoundError();
      return detail();
    }) };
    const retrievePublicPrimaryPhoto = { execute: vi.fn(async ({ publicPropertyId }: { publicPropertyId: string }) => {
      if (publicPropertyId === OTHER_PROPERTY_ID) throw new PublicPropertyNotFoundError();
      return {
        content: new Uint8Array([1, 2, 3]), contentType: "image/png" as const, contentByteSize: 3,
        contentSha256: "a".repeat(64),
      };
    }) };
    const composition = {
      publicCatalogTenantResolver: allowlist.resolver,
      listPublicProperties,
      retrievePublicProperty,
      retrievePublicPrimaryPhoto,
      ...overrides,
    };
    application = await createApiApplication({ logger: false }, composition);
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
    return { listPublicProperties, retrievePublicProperty, retrievePublicPrimaryPhoto };
  }

  async function requestApi(path: string, headers: Readonly<Record<string, string>>): Promise<Response> {
    return new Promise((resolve, reject) => {
      const outgoing = request(`${baseUrl}${path}`, { headers }, (incoming) => {
        const chunks: Uint8Array[] = [];
        incoming.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
            else if (value !== undefined) responseHeaders.set(name, value);
          }
          const status = incoming.statusCode ?? 500;
          resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), {
            status,
            headers: responseHeaders,
          }));
        });
      });
      outgoing.on("error", reject);
      outgoing.end();
    });
  }

  it("lists without Bearer and resolves exactly one tenant from Host", async () => {
    const calls = await start();
    const cursor = encodePublicPropertyCatalogCursor({ publishedAt: PUBLISHED_AT, publicPropertyId: PROPERTY_ID });
    const response = await requestApi(`/v1/public/properties?limit=50&type=HOUSE&transactionType=SALE&cursor=${cursor}`, { host: "catalogue.test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("vary")).toContain("Host");
    const body = PublicPropertyCatalogResponseSchema.parse(await response.json());
    expect(body.items[0]).toEqual({
      ...summary(),
      primaryPhoto: { url: `/v1/public/properties/${PROPERTY_ID}/primary-photo`, contentType: "image/png" },
    });
    expect(calls.listPublicProperties.execute).toHaveBeenCalledWith({
      tenantId: TENANT_A, limit: 50, propertyType: "HOUSE", transactionType: "SALE",
      cursor: { publishedAt: PUBLISHED_AT, publicPropertyId: PROPERTY_ID },
    });
    expect(JSON.stringify(body)).not.toMatch(/tenantId|addressLine|owner|actor|correlation|status|createdAt|updatedAt|photoId|contentSha256|latitude|longitude|publicVisibility/iu);
  });

  it("returns 404 before any query for an unknown Host and ignores forwarded Host", async () => {
    const calls = await start();
    const response = await requestApi("/v1/public/properties", { host: "inconnu.test", "x-forwarded-host": "catalogue.test" });
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PUBLIC_CATALOG_NOT_FOUND");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.listPublicProperties.execute).not.toHaveBeenCalled();
  });

  it("does not accept tenant, status, search or malformed cursor inputs", async () => {
    await start();
    for (const query of ["tenantId=x", "status=PUBLISHED", "search=Lagune", "cursor=not+canonical", "limit=51"]) {
      const response = await requestApi(`/v1/public/properties?${query}`, { host: "catalogue.test" });
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("returns a strict public detail and resolves a second Host independently", async () => {
    const calls = await start();
    const response = await requestApi(`/v1/public/properties/${PROPERTY_ID}`, { host: "autre.test" });
    expect(response.status).toBe(200);
    const body = PublicPropertyDetailSchema.parse(await response.json());
    expect(body).toMatchObject({ publicPropertyId: PROPERTY_ID, description: "Vue sur la lagune", details: { rooms: 5 } });
    expect(calls.retrievePublicProperty.execute).toHaveBeenCalledWith({ tenantId: TENANT_B, publicPropertyId: PROPERTY_ID });
    expect(response.headers.get("vary")).toContain("Host");
  });

  it("uses the same safe 404 for every non-public detail", async () => {
    await start();
    const response = await requestApi(`/v1/public/properties/${OTHER_PROPERTY_ID}`, { host: "catalogue.test" });
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json())).toMatchObject({ code: "PUBLIC_PROPERTY_NOT_FOUND", status: 404 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("validates the public UUID before calling the detail use case", async () => {
    const calls = await start();
    const response = await requestApi("/v1/public/properties/not-an-id", { host: "catalogue.test" });
    expect(response.status).toBe(400);
    expect(calls.retrievePublicProperty.execute).not.toHaveBeenCalled();
  });

  it("serves a binary primary photo with cache, ETag and nosniff headers", async () => {
    await start();
    const response = await requestApi(`/v1/public/properties/${PROPERTY_ID}/primary-photo`, { host: "catalogue.test" });
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("3");
    expect(response.headers.get("etag")).toBe(`"${"a".repeat(64)}"`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("returns 304 on ETag revalidation and 404 when no public photo exists", async () => {
    await start();
    const etag = `"${"a".repeat(64)}"`;
    const cached = await requestApi(`/v1/public/properties/${PROPERTY_ID}/primary-photo`, { host: "catalogue.test", "if-none-match": etag });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    const missing = await requestApi(`/v1/public/properties/${OTHER_PROPERTY_ID}/primary-photo`, { host: "catalogue.test" });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });
});
