import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  PropertyAvailabilityResponseSchema,
  UpdatePropertyAvailabilityRequestSchema,
} from "../../apps/api/src/contracts/v1/properties/property-availability.schema.js";

const artifact = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("Property availability OpenAPI contract", () => {
  it("publishes the authenticated GET and PUT operations with exact statuses", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const path = document.paths["/v1/properties/{propertyId}/availability"];
    expect(path).toBeDefined();
    expect(path).not.toHaveProperty("post");
    expect(path).not.toHaveProperty("patch");
    expect(path).not.toHaveProperty("delete");
    expect(path.get.operationId).toBe("retrievePropertyAvailability");
    expect(path.put.operationId).toBe("updatePropertyAvailability");
    for (const operation of [path.get, path.put]) {
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
    expect(path.get).not.toHaveProperty("requestBody");
  });

  it("publishes a strict pair-only request", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/availability"].put;
    const requestName = operation.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const request = document.components.schemas[requestName];
    expect(request.additionalProperties).toBe(false);
    expect(request.required).toEqual(["availabilityStatus", "occupancyStatus"]);
    expect(request.properties.availabilityStatus.enum).toEqual(["AVAILABLE", "UNAVAILABLE"]);
    expect(request.properties.occupancyStatus.enum).toEqual(expect.arrayContaining(["VACANT", "OCCUPIED"]));
    expect(JSON.stringify(request)).not.toContain("availableFrom");
  });

  it("keeps direct absence, direct configuration and composite derivation explicit", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/availability"].get;
    const responseName = operation.responses["200"].content["application/json"].schema.$ref.split("/").at(-1);
    const response = document.components.schemas[responseName];
    expect(response.oneOf ?? response.anyOf).toHaveLength(3);
    const variants = (response.oneOf ?? response.anyOf).map((variant: { readonly $ref: string }) => {
      const name = variant.$ref.split("/").at(-1);
      if (name === undefined) throw new Error("Availability schema reference is invalid");
      return document.components.schemas[name];
    });
    const serialized = JSON.stringify(variants);
    for (const value of [
      "DIRECT", "DERIVED_FROM_UNITS", "NOT_CONFIGURED", "configured",
      "totalUnitCount", "unconfiguredUnitCount", "canUpdateAvailability",
    ]) expect(serialized).toContain(value);
    expect(serialized).not.toContain("grants");
  });

  it("validates strict schemas locally", () => {
    expect(UpdatePropertyAvailabilityRequestSchema.safeParse({
      availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED",
    }).success).toBe(true);
    expect(UpdatePropertyAvailabilityRequestSchema.safeParse({
      availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED", availableFrom: "2026-09-02",
    }).success).toBe(false);
    expect(PropertyAvailabilityResponseSchema.safeParse({
      propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "UNIT", configured: false,
      canUpdateAvailability: false,
    }).success).toBe(true);
  });
});
