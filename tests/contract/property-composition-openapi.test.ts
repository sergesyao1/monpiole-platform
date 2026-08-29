import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  BuildingResponseSchema,
  CreateUnitSchema,
  PropertyCompositionBuildingPathSchema,
  PropertyCompositionPropertyPathSchema,
  PropertyCompositionUnitPathSchema,
  UnitResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property-composition.schema.js";
import { decodeCompositionCursor, encodeCompositionCursor } from "../../apps/api/src/http/properties/property-composition-cursor.js";

const artifact = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);

const operations = [
  ["/v1/properties/{propertyId}/buildings", "post", "createPropertyBuilding", ["propertyId"], ["201", "400", "401", "403", "404", "409", "500"], "BuildingResponseDto"],
  ["/v1/properties/{propertyId}/buildings", "get", "listPropertyBuildings", ["propertyId"], ["200", "400", "401", "403", "404", "500"], "BuildingPageDto"],
  ["/v1/properties/{propertyId}/buildings/{buildingId}", "put", "updatePropertyBuilding", ["propertyId", "buildingId"], ["200", "400", "401", "403", "404", "409", "500"], "BuildingResponseDto"],
  ["/v1/properties/{propertyId}/buildings/{buildingId}/units", "post", "createPropertyUnit", ["propertyId", "buildingId"], ["201", "400", "401", "403", "404", "409", "500"], "UnitResponseDto"],
  ["/v1/properties/{propertyId}/buildings/{buildingId}/units", "get", "listPropertyUnits", ["propertyId", "buildingId"], ["200", "400", "401", "403", "404", "500"], "UnitPageDto"],
  ["/v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}", "put", "updatePropertyUnitStructure", ["propertyId", "buildingId", "unitPropertyId"], ["200", "400", "401", "403", "404", "409", "500"], "UnitResponseDto"],
] as const;

describe("Property composition OpenAPI contract", () => {
  it("publishes the six authenticated operations with exact required path parameters", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    for (const [path, method, operationId, expectedPathParameters] of operations) {
      const operation = document.paths[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation.operationId).toBe(operationId);
      expect(operation.security).toEqual([{ bearer: [] }]);
      const pathParameters = operation.parameters.filter((parameter: { in: string }) => parameter.in === "path");
      expect(pathParameters.map((parameter: { name: string }) => parameter.name)).toEqual(expectedPathParameters);
      expect(pathParameters.every((parameter: { required?: boolean }) => parameter.required === true)).toBe(true);
    }
  });

  it("publishes success, applicable Problem Details and response tracing headers", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    for (const [path, method, , , expectedStatuses, expectedSuccessSchema] of operations) {
      const operation = document.paths[path][method];
      expect(Object.keys(operation.responses).sort()).toEqual([...expectedStatuses].sort());
      expect(operation.responses[expectedStatuses[0]].content["application/json"].schema)
        .toEqual({ $ref: `#/components/schemas/${expectedSuccessSchema}` });
      for (const status of expectedStatuses) {
        const response = operation.responses[status];
        expect(response.headers).toMatchObject({
          "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
          "X-Request-Id": { schema: { type: "string", format: "uuid" } },
        });
        if (Number(status) >= 400) {
          expect(response.content["application/problem+json"].schema).toEqual({ $ref: "#/components/schemas/ProblemDetails" });
        }
      }
    }
  });

  it("keeps requests strict and aligns Unit bounds with Property", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/buildings/{buildingId}/units"].post;
    const requestName = operation.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const request = document.components.schemas[requestName];
    expect(request.additionalProperties).toBe(false);
    expect(request.required).toEqual(expect.arrayContaining(["unitCode", "title", "propertyType", "transactionType", "location"]));
    expect(request.properties.description.maxLength).toBe(5_000);
    expect(request.properties).not.toHaveProperty("tenantId");
    expect(CreateUnitSchema.safeParse({
      unitCode: "A-101", title: "Appartement", description: "x".repeat(5_000),
      propertyType: "APARTMENT", transactionType: "SALE",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" },
    }).success).toBe(true);
    expect(CreateUnitSchema.safeParse({
      unitCode: "A-101", title: "Appartement", description: "x".repeat(5_001),
      propertyType: "APARTMENT", transactionType: "SALE",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" },
    }).success).toBe(false);
  });

  it("publishes canonical response codes and validates opaque cursors canonically", () => {
    const now = "2026-08-29T10:00:00.000Z";
    expect(BuildingResponseSchema.safeParse({ buildingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", propertyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", buildingCode: "BAT-A", name: "A", createdAt: now, updatedAt: now }).success).toBe(true);
    expect(BuildingResponseSchema.safeParse({ buildingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", propertyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", buildingCode: "bat-a", name: "A", createdAt: now, updatedAt: now }).success).toBe(false);
    expect(UnitResponseSchema.safeParse({ unitCode: "a-101", property: {} }).success).toBe(false);
    const cursor = { code: "A-101", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    expect(decodeCompositionCursor(encodeCompositionCursor(cursor))).toEqual(cursor);
    expect(() => decodeCompositionCursor(encodeCompositionCursor({ ...cursor, code: "a-101" }))).toThrow();
  });

  it("keeps the three path schemas strict and non-interchangeable", () => {
    const propertyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const buildingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const unitPropertyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect(PropertyCompositionPropertyPathSchema.safeParse({ propertyId }).success).toBe(true);
    expect(PropertyCompositionPropertyPathSchema.safeParse({ propertyId, buildingId }).success).toBe(false);
    expect(PropertyCompositionBuildingPathSchema.safeParse({ propertyId, buildingId }).success).toBe(true);
    expect(PropertyCompositionBuildingPathSchema.safeParse({ propertyId, buildingId, unitPropertyId }).success).toBe(false);
    expect(PropertyCompositionUnitPathSchema.safeParse({ propertyId, buildingId, unitPropertyId }).success).toBe(true);
  });
});
