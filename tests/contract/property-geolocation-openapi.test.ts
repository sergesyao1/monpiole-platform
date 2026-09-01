import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  PropertyGeolocationResponseSchema,
  UpdatePropertyGeolocationRequestSchema,
} from "../../apps/api/src/contracts/v1/properties/property-geolocation.schema.js";

const artifact = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);

describe("Property geolocation OpenAPI contract", () => {
  it("publishes the authenticated GET, PUT and DELETE vertical slice", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const path = document.paths["/v1/properties/{propertyId}/geolocation"];
    expect(path).toBeDefined();
    expect(path.get.operationId).toBe("retrievePropertyGeolocation");
    expect(path.put.operationId).toBe("updatePropertyGeolocation");
    expect(path.delete.operationId).toBe("removePropertyGeolocation");
    for (const operation of [path.get, path.put, path.delete]) {
      expect(operation.security).toEqual([{ bearer: [] }]);
      expect(operation.parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: "propertyId", in: "path", required: true,
          schema: expect.objectContaining({ format: "uuid" }),
        }),
      ]));
      for (const response of Object.values(operation.responses) as Array<Record<string, unknown>>) {
        expect(response.headers).toMatchObject({
          "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
          "X-Request-Id": { schema: { type: "string", format: "uuid" } },
        });
      }
    }
    expect(Object.keys(path.get.responses).sort()).toEqual(["200", "400", "401", "403", "404", "500"]);
    expect(Object.keys(path.put.responses).sort()).toEqual(["200", "400", "401", "403", "404", "409", "500"]);
    expect(Object.keys(path.delete.responses).sort()).toEqual(["204", "400", "401", "403", "404", "409", "500"]);
    expect(path.delete).not.toHaveProperty("requestBody");
  });

  it("publishes strict provider-neutral coordinates and the three privacy decisions", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/geolocation"].put;
    const requestName = operation.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const request = document.components.schemas[requestName];
    expect(request.additionalProperties).toBe(false);
    expect(request.required).toEqual(["latitude", "longitude", "publicVisibility"]);
    expect(request.properties.latitude).toMatchObject({ minimum: -90, maximum: 90, multipleOf: 0.000001 });
    expect(request.properties.longitude).toMatchObject({ minimum: -180, maximum: 180, multipleOf: 0.000001 });
    expect(request.properties.publicVisibility.enum).toEqual(expect.arrayContaining(["EXACT", "APPROXIMATE", "HIDDEN"]));
    expect(JSON.stringify(request)).not.toMatch(/provider|mapbox|google|geocoder/iu);
  });

  it("keeps configured absence and Unit inheritance explicit in the response", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/geolocation"].get;
    const responseName = operation.responses["200"].content["application/json"].schema.$ref.split("/").at(-1);
    const response = document.components.schemas[responseName];
    const serialized = JSON.stringify(response);
    expect(response.oneOf ?? response.anyOf).toHaveLength(4);
    for (const value of ["OWN", "INHERITED", "EXACT", "APPROXIMATE", "HIDDEN", "inheritedFromPropertyId"]) {
      expect(serialized).toContain(value);
    }
  });

  it("validates transport precision and strictness locally", () => {
    expect(UpdatePropertyGeolocationRequestSchema.safeParse({
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN",
    }).success).toBe(true);
    expect(UpdatePropertyGeolocationRequestSchema.safeParse({
      latitude: 5.1234567, longitude: -4, publicVisibility: "HIDDEN",
    }).success).toBe(false);
    expect(UpdatePropertyGeolocationRequestSchema.safeParse({
      latitude: 5, longitude: -4, publicVisibility: "HIDDEN", tenantId: "forbidden",
    }).success).toBe(false);
    expect(PropertyGeolocationResponseSchema.safeParse({
      configured: false, source: "INHERITED", inheritedFromPropertyId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }).success).toBe(true);
  });
});
