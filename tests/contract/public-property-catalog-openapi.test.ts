import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ListPublicPropertiesQuerySchema,
  PublicPropertyCatalogResponseSchema,
  PublicPropertyDetailSchema,
} from "../../apps/api/src/contracts/v1/public-properties/public-property.schema.js";

const openApiPath = fileURLToPath(new URL("../../engineering/contracts/http/openapi.json", import.meta.url));
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("public Property catalog OpenAPI contract", () => {
  it("publishes anonymous list/detail/photo routes without normal 401 or 403 responses", async () => {
    const document = JSON.parse(await readFile(openApiPath, "utf8"));
    const list = document.paths["/v1/public/properties"]?.get;
    const detail = document.paths["/v1/public/properties/{publicPropertyId}"]?.get;
    const photo = document.paths["/v1/public/properties/{publicPropertyId}/primary-photo"]?.get;
    expect(list?.operationId).toBe("listPublicProperties");
    expect(detail?.operationId).toBe("retrievePublicProperty");
    expect(photo?.operationId).toBe("retrievePublicPropertyPrimaryPhoto");
    for (const operation of [list, detail, photo]) {
      expect(operation.security).toEqual([]);
      expect(operation.responses).not.toHaveProperty("401");
      expect(operation.responses).not.toHaveProperty("403");
      expect(operation).not.toHaveProperty("requestBody");
    }
    expect(Object.keys(list.responses)).toEqual(expect.arrayContaining(["200", "400", "404", "500"]));
    expect(Object.keys(photo.responses)).toEqual(expect.arrayContaining(["200", "304", "400", "404", "500"]));
  });

  it("publishes only limit, cursor, type and transactionType as bounded list inputs", async () => {
    const document = JSON.parse(await readFile(openApiPath, "utf8"));
    const list = document.paths["/v1/public/properties"].get;
    const parameters = Object.fromEntries(list.parameters.map((parameter: { name: string }) => [parameter.name, parameter]));
    expect(Object.keys(parameters).sort()).toEqual(["cursor", "limit", "transactionType", "type"]);
    expect(parameters.limit.schema).toMatchObject({ minimum: 1, maximum: 50, default: 20 });
    expect(parameters.cursor.schema).toMatchObject({ maxLength: 512 });
    expect(JSON.stringify(list)).not.toMatch(/tenantId|status|search|addressLine/iu);
  });

  it("keeps public response components free of tenant, owner, authority and persistence fields", async () => {
    const document = JSON.parse(await readFile(openApiPath, "utf8"));
    const componentText = JSON.stringify(Object.fromEntries(Object.entries(document.components.schemas)
      .filter(([name]) => name.startsWith("PublicProperty"))));
    expect(componentText).not.toMatch(/tenantId|addressLine|owner|ownership|actor|authority|correlation|publishedBy|withdrawnAt|canWithdrawFromCatalog|photoStandard|createdAt|updatedAt|photoId|contentSha256|contentByteSize|contentBase64|buildingId|unitPropertyId|latitude|longitude|publicVisibility/iu);
    expect(componentText).toMatch(/publicPropertyId/u);
    expect(componentText).toMatch(/primaryPhoto/u);
  });

  it("validates strict whitelist DTOs and rejects authoritative fields", () => {
    expect(ListPublicPropertiesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListPublicPropertiesQuerySchema.safeParse({ limit: 50, type: "HOUSE", transactionType: "SALE" }).success).toBe(true);
    for (const invalid of [{ tenantId: PROPERTY_ID }, { status: "PUBLISHED" }, { search: "Lagune" }, { limit: 51 }]) {
      expect(ListPublicPropertiesQuerySchema.safeParse(invalid).success).toBe(false);
    }
    const summary = {
      publicPropertyId: PROPERTY_ID,
      title: "Maison",
      propertyType: "HOUSE",
      transactionType: "SALE",
      structuralRole: "STANDALONE",
      location: { country: "CI", city: "Abidjan", district: "Cocody" },
      commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
      primaryPhoto: null,
      publishedAt: "2026-08-31T10:00:00.000Z",
    };
    expect(PublicPropertyCatalogResponseSchema.safeParse({ items: [summary], pageInfo: { nextCursor: null, hasNextPage: false } }).success).toBe(true);
    expect(PublicPropertyDetailSchema.safeParse({ ...summary, description: null, details: { rooms: 4 } }).success).toBe(true);
    expect(PublicPropertyDetailSchema.safeParse({ ...summary, description: null, details: { rooms: 4 }, tenantId: PROPERTY_ID }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...summary, description: null, details: { rooms: 4 }, withdrawnAt: "2026-09-01T10:00:00.000Z" }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...summary, description: null, details: { rooms: 4 }, location: { ...summary.location, addressLine: "privée" } }).success).toBe(false);
  });
});
