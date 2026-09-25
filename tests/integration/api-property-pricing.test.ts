import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { PropertyResponseSchema } from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import {
  Property,
  SetPropertyPricing,
  UpdatePropertyDetails,
  type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-09-01T12:00:00.000Z";

function property() {
  return Property.create({
    propertyId: PROPERTY_ID,
    tenantId: TENANT_A,
    title: "Maison Lagune",
    propertyType: "HOUSE",
    transactionType: "SALE",
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  });
}

class MemoryRepository implements PropertyRepository {
  value: Property | undefined = property();
  writes = 0;
  async saveStandalone() {}
  async findById(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.value : undefined;
  }
  async updateAtomically(tenantId: string, propertyId: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    if (tenantId !== TENANT_A || propertyId !== PROPERTY_ID || this.value === undefined) return undefined;
    const next = update(this.value, []);
    if (next !== this.value) { this.value = next; this.writes += 1; }
    return this.value;
  }
}

describe("Property pricing HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const repository = new MemoryRepository();

  async function start(options: { tenantId?: string | null; grants?: readonly string[] } = {}) {
    const tenantId = options.tenantId === undefined ? TENANT_A : options.tenantId;
    const grants = options.grants ?? ["UPDATE_PROPERTY_PRICING", "UPDATE_PROPERTY_DETAILS"];
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: {
        resolve: async () => tenantId === null ? undefined : ({
          actorId: "actor", authorityId: "authority", grants: grants as never, tenantIds: [tenantId],
        }),
      },
      setPropertyPricing: new SetPropertyPricing(repository, { now: () => NOW }),
      updatePropertyDetails: new UpdatePropertyDetails(repository, { now: () => NOW }),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  const endpoint = (propertyId = PROPERTY_ID) => `${baseUrl}/v1/properties/${propertyId}/pricing`;
  const put = (body: unknown, propertyId = PROPERTY_ID) => fetch(endpoint(propertyId), {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

  async function stop() { await application?.close(); application = undefined; }

  afterEach(async () => {
    await stop();
    repository.value = property();
    repository.writes = 0;
  });

  it("sets advanced pricing and replays the exact payload", async () => {
    await start();
    const body = { kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 };
    const response = await put(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(PropertyResponseSchema.parse(await response.json())).toMatchObject({ commercialTerms: body, updatedAt: NOW });
    const replay = await put(body);
    expect(replay.status).toBe(200);
    expect(repository.writes).toBe(1);
  });

  it.each([
    [{ kind: "SALE", currency: "EUR", salePriceAmountMinor: 1 }],
    [{ kind: "SALE", currency: "XOF", salePriceAmountMinor: 0 }],
    [{ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1, agencyFeeAmountMinor: -1 }],
    [{ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1, tenantId: TENANT_A }],
    [{ kind: "SALE", currency: "XOF" }],
  ])("rejects a non-strict pricing body %#", async (body) => {
    await start();
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
    expect(repository.writes).toBe(0);
  });

  it("rejects a pricing variant incompatible with the Property transaction type", async () => {
    await start();
    const response = await put({
      kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45_000,
      pricingUnit: "NIGHT", cleaningFeeAmountMinor: 5_000, minimumStayNights: 2,
    });
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("authenticates, authorizes and hides cross-tenant Properties", async () => {
    await start({ tenantId: null });
    expect((await put({ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 })).status).toBe(401);
    await stop();
    await start({ grants: [] });
    expect((await put({ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 })).status).toBe(403);
    await stop();
    await start({ tenantId: TENANT_B });
    const response = await put({ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 });
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("PROPERTY_NOT_FOUND");
  });

  it("validates the path and preserves legacy pricing on a detail-only request", async () => {
    repository.value = Property.rehydrate({
      ...property().values,
      details: { rooms: 2 },
      commercialTerms: { kind: "SALE", currency: "EUR", salePriceAmountMinor: 0 },
    }, { allowLegacyPricing: true });
    await start();
    expect((await put({ kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 }, "not-a-uuid")).status).toBe(400);
    const details = await fetch(`${baseUrl}/v1/properties/${PROPERTY_ID}/details`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ details: { rooms: 3 } }),
    });
    expect(details.status).toBe(200);
    expect(PropertyResponseSchema.parse(await details.json())).toMatchObject({
      details: { rooms: 3 }, commercialTerms: { currency: "EUR", salePriceAmountMinor: 0 },
    });
  });
});
