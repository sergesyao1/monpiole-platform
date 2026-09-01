import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  PropertyAvailabilityResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property-availability.schema.js";
import {
  Property,
  RetrievePropertyAvailability,
  UpdatePropertyAvailability,
  type PropertyAvailabilityQuery,
  type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-09-01T12:00:00.000Z";

function property() {
  return Property.create({
    propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Maison Lagune",
    propertyType: "HOUSE", transactionType: "SALE",
    location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
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

class MemoryQuery implements PropertyAvailabilityQuery {
  constructor(private readonly repository: MemoryRepository) {}
  fail = false;
  async retrieve(tenantId: string, propertyId: string) {
    if (this.fail) throw new Error("private availability storage exploded");
    const property = await this.repository.findById(tenantId, propertyId);
    if (property === undefined) return undefined;
    if (property.values.structuralRole === "COMPOSITE") return {
      propertyId, source: "DERIVED_FROM_UNITS" as const, structuralRole: "COMPOSITE" as const,
      availabilityStatus: "AVAILABLE" as const, totalUnitCount: 3, configuredUnitCount: 2,
      availableUnitCount: 1, unavailableUnitCount: 1, vacantUnitCount: 1,
      occupiedUnitCount: 1, unconfiguredUnitCount: 1,
    };
    const snapshot = property.values.availability;
    return snapshot === undefined
      ? { propertyId, source: "DIRECT" as const, structuralRole: property.values.structuralRole, configured: false as const }
      : { propertyId, source: "DIRECT" as const, structuralRole: property.values.structuralRole, configured: true as const, ...snapshot };
  }
}

describe("Property availability HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const repository = new MemoryRepository();
  const query = new MemoryQuery(repository);

  async function start(options: { tenantId?: string | null; grants?: readonly string[] } = {}) {
    const tenantId = options.tenantId === undefined ? TENANT_A : options.tenantId;
    const grants = options.grants ?? ["RETRIEVE_PROPERTY_AVAILABILITY", "UPDATE_PROPERTY_AVAILABILITY"];
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: {
        resolve: async () => tenantId === null ? undefined : ({
          actorId: "actor", authorityId: "authority", grants: grants as never, tenantIds: [tenantId],
        }),
      },
      retrievePropertyAvailability: new RetrievePropertyAvailability(query),
      updatePropertyAvailability: new UpdatePropertyAvailability(repository, { now: () => NOW }),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  const endpoint = (propertyId = PROPERTY_ID) => `${baseUrl}/v1/properties/${propertyId}/availability`;
  const put = (body: unknown, propertyId = PROPERTY_ID) => fetch(endpoint(propertyId), {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

  async function stop() { await application?.close(); application = undefined; }

  afterEach(async () => {
    await stop();
    repository.value = property();
    repository.writes = 0;
    query.fail = false;
  });

  it("retrieves absence, configures the pair and replays with the original timestamp", async () => {
    await start();
    const empty = await fetch(endpoint());
    expect(empty.status).toBe(200);
    expect(PropertyAvailabilityResponseSchema.parse(await empty.json())).toEqual({
      propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "STANDALONE",
      configured: false, canUpdateAvailability: true,
    });

    const configured = await put({ availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED" });
    expect(configured.status).toBe(200);
    expect(configured.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(PropertyAvailabilityResponseSchema.parse(await configured.json())).toMatchObject({
      configured: true, availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED", updatedAt: NOW,
    });
    const replay = await put({ availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED" });
    expect(PropertyAvailabilityResponseSchema.parse(await replay.json())).toMatchObject({ updatedAt: NOW });
    expect(repository.writes).toBe(1);
  });

  it.each([
    [{ availabilityStatus: "PENDING", occupancyStatus: "VACANT" }],
    [{ availabilityStatus: "AVAILABLE", occupancyStatus: "LEASED" }],
    [{ availabilityStatus: "AVAILABLE", occupancyStatus: "VACANT", availableFrom: "2026-09-02" }],
    [{ availabilityStatus: "AVAILABLE" }],
  ])("rejects an invalid or extended strict body %#", async (body) => {
    await start();
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
    expect(repository.writes).toBe(0);
  });

  it("authenticates, authorizes and hides cross-tenant Properties identically", async () => {
    await start({ tenantId: null });
    expect((await fetch(endpoint())).status).toBe(401);
    await stop();
    await start({ grants: [] });
    expect((await fetch(endpoint())).status).toBe(403);
    expect((await put({ availabilityStatus: "AVAILABLE", occupancyStatus: "VACANT" })).status).toBe(403);
    await stop();
    await start({ tenantId: TENANT_B });
    const crossTenant = await fetch(endpoint());
    expect(crossTenant.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await crossTenant.json()).code).toBe("PROPERTY_NOT_FOUND");
    const crossTenantUpdate = await put({ availabilityStatus: "AVAILABLE", occupancyStatus: "VACANT" });
    expect(crossTenantUpdate.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await crossTenantUpdate.json()).code).toBe("PROPERTY_NOT_FOUND");
  });

  it("returns the derived COMPOSITE summary and rejects direct mutation with the stable conflict", async () => {
    repository.value = property().becomeComposite(NOW);
    await start();
    const response = await fetch(endpoint());
    expect(PropertyAvailabilityResponseSchema.parse(await response.json())).toMatchObject({
      source: "DERIVED_FROM_UNITS", availabilityStatus: "AVAILABLE", totalUnitCount: 3,
      configuredUnitCount: 2, unconfiguredUnitCount: 1, canUpdateAvailability: false,
    });
    const update = await put({ availabilityStatus: "UNAVAILABLE", occupancyStatus: "VACANT" });
    expect(update.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await update.json()).code).toBe("PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS");
  });

  it("validates the path and hides unexpected persistence details", async () => {
    await start();
    expect((await fetch(endpoint("not-a-uuid"))).status).toBe(400);
    query.fail = true;
    const response = await fetch(endpoint());
    expect(response.status).toBe(500);
    const problem = ProblemDetailsSchema.parse(await response.json());
    expect(problem.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(problem)).not.toMatch(/storage|availability storage/iu);
  });
});
