import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CreatePropertyOwnerRequestSchema, PropertyOwnerResponseSchema, UpdatePropertyOwnerRequestSchema,
} from "../../apps/api/src/contracts/v1/properties/property-owner.schema.js";

const path = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);

describe("PropertyOwner API contract", () => {
  it("publishes authenticated create, retrieve and update operations", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const create = document.paths["/v1/property-owners"]?.post;
    const resource = document.paths["/v1/property-owners/{ownerId}"];
    expect(create).toBeDefined(); expect(resource?.get).toBeDefined(); expect(resource?.put).toBeDefined();
    for (const operation of [create, resource.get, resource.put]) expect(operation.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(create.responses)).toEqual(expect.arrayContaining(["201", "400", "401", "403", "500"]));
    for (const operation of [resource.get, resource.put]) {
      expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    }
  });

  it("uses explicit discriminated variants without tenant-controlled fields", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const create = document.paths["/v1/property-owners"].post;
    const schema = create.requestBody.content["application/json"].schema;
    expect(schema.discriminator).toEqual({ propertyName: "ownerType" }); expect(schema.oneOf).toHaveLength(2);
    const variants = schema.oneOf.map((item: { $ref: string }) => document.components.schemas[item.$ref.split("/").at(-1)!]);
    expect(JSON.stringify(variants)).toContain("INDIVIDUAL"); expect(JSON.stringify(variants)).toContain("LEGAL_ENTITY");
    for (const variant of variants) {
      expect(variant.additionalProperties).toBe(false);
      expect(variant.properties).not.toHaveProperty("tenantId"); expect(variant.properties).not.toHaveProperty("ownerId");
    }
  });

  it("accepts coherent variants and rejects mixed or authoritative fields", () => {
    const individual = { ownerType: "INDIVIDUAL", firstName: "Jean", lastName: "Kouassi", email: "jean@example.com" };
    const legalEntity = { ownerType: "LEGAL_ENTITY", legalName: "Immobilière Plateau SA", registrationNumber: "CI-ABJ-2026-B-00000" };
    expect(CreatePropertyOwnerRequestSchema.safeParse(individual).success).toBe(true);
    expect(UpdatePropertyOwnerRequestSchema.safeParse(legalEntity).success).toBe(true);
    expect(CreatePropertyOwnerRequestSchema.safeParse({ ...individual, legalName: "Mixed" }).success).toBe(false);
    expect(CreatePropertyOwnerRequestSchema.safeParse({ ...legalEntity, firstName: "Mixed" }).success).toBe(false);
    expect(CreatePropertyOwnerRequestSchema.safeParse({ ...individual, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).success).toBe(false);
    expect(CreatePropertyOwnerRequestSchema.safeParse({ ...individual, ownerType: "UNKNOWN" }).success).toBe(false);
  });

  it("keeps response enums stable and presentation-neutral", () => {
    const response = {
      ownerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", ownerType: "INDIVIDUAL",
      firstName: "Jean", lastName: "Kouassi",
      createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
    };
    expect(PropertyOwnerResponseSchema.parse(response).ownerType).toBe("INDIVIDUAL");
    expect(JSON.stringify(PropertyOwnerResponseSchema)).not.toContain("Personne physique");
  });
});
