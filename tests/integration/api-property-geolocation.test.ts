import { afterEach, describe, expect, it } from "vitest";

import {
  PropertyGeolocation,
  PropertyUnitGeolocationInheritedError,
  RemovePropertyGeolocation,
  RetrievePropertyGeolocation,
  UpdatePropertyGeolocation,
  type PropertyGeolocationMutationTrace,
  type PropertyGeolocationRepository,
} from "../../services/property-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyGeolocationResponseSchema } from "../../apps/api/src/contracts/v1/properties/property-geolocation.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

class MemoryGeolocationRepository implements PropertyGeolocationRepository {
  exists = true;
  unit = false;
  value?: PropertyGeolocation;

  async findEffective(tenantId: string, propertyId: string) {
    if (!this.exists || tenantId !== TENANT_A || propertyId !== PROPERTY_ID) return undefined;
    return { source: "OWN" as const, geolocation: this.value };
  }

  async saveOwn(tenantId: string, propertyId: string, value: PropertyGeolocation, _trace: PropertyGeolocationMutationTrace) {
    if (this.unit) throw new PropertyUnitGeolocationInheritedError();
    if (!this.exists || tenantId !== TENANT_A || propertyId !== PROPERTY_ID) return undefined;
    this.value = value;
    return value;
  }

  async removeOwn(tenantId: string, propertyId: string) {
    if (this.unit) throw new PropertyUnitGeolocationInheritedError();
    if (!this.exists || tenantId !== TENANT_A || propertyId !== PROPERTY_ID) return undefined;
    const removed = this.value !== undefined;
    this.value = undefined;
    return removed;
  }
}

describe("Property geolocation HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const repository = new MemoryGeolocationRepository();

  async function start(options: { tenantId?: string | null; grants?: readonly string[] } = {}) {
    const tenantId = options.tenantId === undefined ? TENANT_A : options.tenantId;
    const grants = options.grants ?? [
      "RETRIEVE_PROPERTY_GEOLOCATION", "UPDATE_PROPERTY_GEOLOCATION", "REMOVE_PROPERTY_GEOLOCATION",
    ];
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: {
        resolve: async () => tenantId === null ? undefined : ({
          actorId: "actor", authorityId: "authority", grants: grants as never, tenantIds: [tenantId],
        }),
      },
      retrievePropertyGeolocation: new RetrievePropertyGeolocation(repository),
      updatePropertyGeolocation: new UpdatePropertyGeolocation(repository, { now: () => "2026-08-31T12:00:00.000Z" }),
      removePropertyGeolocation: new RemovePropertyGeolocation(repository),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  const endpoint = (propertyId = PROPERTY_ID) => `${baseUrl}/v1/properties/${propertyId}/geolocation`;
  const put = (body: unknown, propertyId = PROPERTY_ID) => fetch(endpoint(propertyId), {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

  async function stop() {
    await application?.close();
    application = undefined;
  }

  afterEach(async () => {
    await stop();
    repository.exists = true;
    repository.unit = false;
    repository.value = undefined;
  });

  it("retrieves absence, creates, replaces and idempotently removes the private position", async () => {
    await start();
    const empty = await fetch(endpoint());
    expect(empty.status).toBe(200);
    expect(PropertyGeolocationResponseSchema.parse(await empty.json())).toEqual({ configured: false, source: "OWN" });

    const created = await put({ latitude: 5.336789, longitude: -4.027123, publicVisibility: "APPROXIMATE" });
    expect(created.status).toBe(200);
    expect(created.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(PropertyGeolocationResponseSchema.parse(await created.json())).toEqual({
      configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123,
      publicVisibility: "APPROXIMATE",
    });

    const replaced = await put({ latitude: 5.35, longitude: -4.01, publicVisibility: "HIDDEN" });
    expect(PropertyGeolocationResponseSchema.parse(await replaced.json())).toMatchObject({
      configured: true, latitude: 5.35, longitude: -4.01, publicVisibility: "HIDDEN",
    });
    expect((await fetch(endpoint(), { method: "DELETE" })).status).toBe(204);
    expect((await fetch(endpoint(), { method: "DELETE" })).status).toBe(204);
  });

  it.each([
    [{ latitude: 90.000001, longitude: 0, publicVisibility: "HIDDEN" }],
    [{ latitude: 0, longitude: -180.000001, publicVisibility: "HIDDEN" }],
    [{ latitude: 5.1234567, longitude: -4, publicVisibility: "HIDDEN" }],
    [{ latitude: 5, longitude: -4, publicVisibility: "PUBLIC" }],
    [{ latitude: 5, longitude: -4, publicVisibility: "HIDDEN", tenantId: TENANT_A }],
  ])("rejects invalid or caller-controlled input %#", async (body) => {
    await start();
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("authenticates, authorizes and hides unknown or cross-tenant Properties", async () => {
    await start({ tenantId: null });
    expect((await fetch(endpoint())).status).toBe(401);
    await stop();
    await start({ grants: [] });
    expect((await fetch(endpoint())).status).toBe(403);
    await stop();
    await start({ tenantId: TENANT_B });
    expect((await fetch(endpoint())).status).toBe(404);
    await stop();
    await start();
    expect((await fetch(endpoint("not-a-uuid"))).status).toBe(400);
  });

  it("returns a stable conflict when a Unit attempts to override or remove inherited coordinates", async () => {
    repository.unit = true;
    await start();
    const update = await put({ latitude: 5, longitude: -4, publicVisibility: "HIDDEN" });
    expect(update.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await update.json()).code).toBe("PROPERTY_UNIT_GEOLOCATION_INHERITED");
    const remove = await fetch(endpoint(), { method: "DELETE" });
    expect(remove.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await remove.json()).code).toBe("PROPERTY_UNIT_GEOLOCATION_INHERITED");
  });

  it("does not disclose unexpected persistence details", async () => {
    await start();
    repository.findEffective = async () => { throw new Error("private coordinate storage exploded"); };
    const response = await fetch(endpoint());
    expect(response.status).toBe(500);
    const problem = ProblemDetailsSchema.parse(await response.json());
    expect(problem.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(problem)).not.toMatch(/coordinate|storage|latitude|longitude/u);
  });
});
