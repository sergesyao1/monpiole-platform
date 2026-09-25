import { describe, expect, it } from "vitest";

import {
  InvalidPropertyGeolocationInputError,
  PropertyForbiddenError,
  PropertyGeolocation,
  PropertyNotFoundError,
  RemovePropertyGeolocation,
  RetrievePropertyGeolocation,
  UpdatePropertyGeolocation,
  type PropertyAuthority,
  type PropertyGeolocationMutationTrace,
  type PropertyGeolocationRepository,
  type PropertyGeolocationResolution,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function authority(tenantId = TENANT_A, grants: PropertyAuthority["grants"] = [
  "RETRIEVE_PROPERTY_GEOLOCATION",
  "UPDATE_PROPERTY_GEOLOCATION",
  "REMOVE_PROPERTY_GEOLOCATION",
]): PropertyAuthority {
  return { actorId: "actor", authorityId: "authority", grants, tenantIds: [tenantId] };
}

function geolocation(overrides: Partial<Parameters<typeof PropertyGeolocation.create>[0]> = {}) {
  return PropertyGeolocation.create({
    propertyId: PROPERTY_ID,
    tenantId: TENANT_A,
    latitude: 5.336789,
    longitude: -4.027123,
    publicVisibility: "HIDDEN",
    ...overrides,
  });
}

class MemoryGeolocationRepository implements PropertyGeolocationRepository {
  readonly properties = new Set([`${TENANT_A}:${PROPERTY_ID}`]);
  readonly values = new Map<string, PropertyGeolocation>();
  resolution?: PropertyGeolocationResolution;
  lastTrace?: PropertyGeolocationMutationTrace;
  saveCalls = 0;
  removeCalls = 0;

  async findEffective(tenantId: string, propertyId: string) {
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return undefined;
    return this.resolution ?? { source: "OWN" as const, geolocation: this.values.get(`${tenantId}:${propertyId}`) };
  }

  async saveOwn(tenantId: string, propertyId: string, value: PropertyGeolocation, trace: PropertyGeolocationMutationTrace) {
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return undefined;
    this.saveCalls += 1;
    this.lastTrace = trace;
    const key = `${tenantId}:${propertyId}`;
    const current = this.values.get(key);
    if (current?.samePositionAs(value)) return current;
    this.values.set(key, value);
    return value;
  }

  async removeOwn(tenantId: string, propertyId: string) {
    if (!this.properties.has(`${tenantId}:${propertyId}`)) return undefined;
    this.removeCalls += 1;
    return this.values.delete(`${tenantId}:${propertyId}`);
  }
}

describe("Property geolocation domain", () => {
  it.each([
    [-90, -180],
    [90, 180],
    [5.336789, -4.027123],
  ])("accepts canonical WGS84 coordinates %s/%s", (latitude, longitude) => {
    expect(geolocation({ latitude, longitude }).values).toMatchObject({ latitude, longitude });
  });

  it.each([
    [Number.NaN, -4, "latitude"],
    [Number.POSITIVE_INFINITY, -4, "latitude"],
    [-90.000001, -4, "latitude"],
    [90.000001, -4, "latitude"],
    [5, -180.000001, "longitude"],
    [5, 180.000001, "longitude"],
    [5.1234567, -4, "latitude"],
    [5, -4.1234567, "longitude"],
  ] as const)("rejects invalid coordinate %s/%s", (latitude, longitude, field) => {
    expect(() => geolocation({ latitude, longitude })).toThrowError(
      expect.objectContaining({ code: "INVALID_PROPERTY_GEOLOCATION_INPUT", field }),
    );
  });

  it("rejects unsupported public visibility", () => {
    expect(() => geolocation({ publicVisibility: "PUBLIC" as never }))
      .toThrowError(InvalidPropertyGeolocationInputError);
  });

  it("keeps exact, approximate and hidden public decisions deterministic", () => {
    expect(geolocation({ publicVisibility: "EXACT" }).publicPosition())
      .toEqual({ latitude: 5.336789, longitude: -4.027123, precision: "EXACT" });
    expect(geolocation({ publicVisibility: "APPROXIMATE" }).publicPosition())
      .toEqual({ latitude: 5.34, longitude: -4.03, precision: "APPROXIMATE" });
    expect(geolocation({ latitude: -0.000001, longitude: -0.000001, publicVisibility: "APPROXIMATE" }).publicPosition())
      .toEqual({ latitude: 0, longitude: 0, precision: "APPROXIMATE" });
    expect(geolocation({ publicVisibility: "HIDDEN" }).publicPosition()).toBeUndefined();
  });
});

describe("Property geolocation application", () => {
  it("retrieves an unconfigured own position without inventing coordinates", async () => {
    await expect(new RetrievePropertyGeolocation(new MemoryGeolocationRepository()).execute({
      authority: authority(), propertyId: PROPERTY_ID,
    })).resolves.toEqual({ configured: false, source: "OWN" });
  });

  it("updates, traces, retrieves and idempotently removes an own position", async () => {
    const repository = new MemoryGeolocationRepository();
    const update = new UpdatePropertyGeolocation(repository, { now: () => "2026-08-31T12:00:00.000Z" });
    const command = {
      authority: authority(), correlationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", propertyId: PROPERTY_ID,
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "APPROXIMATE" as const,
    };
    await expect(update.execute(command)).resolves.toEqual({
      configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123,
      publicVisibility: "APPROXIMATE",
    });
    expect(repository.lastTrace).toEqual({
      updatedAt: "2026-08-31T12:00:00.000Z", correlationId: command.correlationId, actorId: "actor",
    });
    await update.execute(command);
    expect(repository.saveCalls).toBe(2);
    await expect(new RetrievePropertyGeolocation(repository).execute({ authority: authority(), propertyId: PROPERTY_ID }))
      .resolves.toMatchObject({ configured: true, source: "OWN", publicVisibility: "APPROXIMATE" });
    const remove = new RemovePropertyGeolocation(repository);
    await expect(remove.execute({ authority: authority(), correlationId: command.correlationId, propertyId: PROPERTY_ID }))
      .resolves.toBeUndefined();
    await expect(remove.execute({ authority: authority(), correlationId: command.correlationId, propertyId: PROPERTY_ID }))
      .resolves.toBeUndefined();
    expect(repository.removeCalls).toBe(2);
  });

  it("represents Unit inheritance without copying parent coordinates", async () => {
    const repository = new MemoryGeolocationRepository();
    repository.resolution = {
      source: "INHERITED", inheritedFromPropertyId: PARENT_ID,
      geolocation: geolocation({ propertyId: PARENT_ID, publicVisibility: "HIDDEN" }),
    };
    await expect(new RetrievePropertyGeolocation(repository).execute({ authority: authority(), propertyId: PROPERTY_ID }))
      .resolves.toEqual({
        configured: true, source: "INHERITED", inheritedFromPropertyId: PARENT_ID,
        latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN",
      });
  });

  it("enforces dedicated grants and tenant non-disclosure", async () => {
    const repository = new MemoryGeolocationRepository();
    await expect(new RetrievePropertyGeolocation(repository).execute({ authority: authority(TENANT_A, []), propertyId: PROPERTY_ID }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(new RetrievePropertyGeolocation(repository).execute({ authority: authority(TENANT_B), propertyId: PROPERTY_ID }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(new UpdatePropertyGeolocation(repository, { now: () => "unused" }).execute({
      authority: authority(TENANT_A, []), correlationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      propertyId: PROPERTY_ID, latitude: 5, longitude: -4, publicVisibility: "HIDDEN",
    })).rejects.toBeInstanceOf(PropertyForbiddenError);
  });
});
