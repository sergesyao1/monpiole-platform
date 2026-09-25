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
    const media = document.paths["/v1/public/properties/{publicPropertyId}/media/{mediaId}/content"]?.get;
    expect(list?.operationId).toBe("listPublicProperties");
    expect(detail?.operationId).toBe("retrievePublicProperty");
    expect(photo?.operationId).toBe("retrievePublicPropertyPrimaryPhoto");
    expect(media?.operationId).toBe("retrievePublicPropertyMedia");
    for (const operation of [list, detail, photo, media]) {
      expect(operation.security).toEqual([]);
      expect(operation.responses).not.toHaveProperty("401");
      expect(operation.responses).not.toHaveProperty("403");
      expect(operation).not.toHaveProperty("requestBody");
    }
    expect(Object.keys(list.responses)).toEqual(expect.arrayContaining(["200", "400", "404", "500"]));
    expect(Object.keys(photo.responses)).toEqual(expect.arrayContaining(["200", "304", "400", "404", "500"]));
    expect(Object.keys(media.responses)).toEqual(expect.arrayContaining(["200", "304", "400", "404", "500"]));
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
    expect(componentText).not.toMatch(/tenantId|addressLine|owner|ownership|actor|authority|correlation|publishedBy|withdrawnAt|canWithdrawFromCatalog|photoStandard|createdAt|updatedAt|photoId|contentSha256|contentByteSize|contentBase64|buildingId|unitPropertyId|latitude|longitude|publicVisibility|availability|occupancy/iu);
    expect(componentText).toMatch(/publicPropertyId/u);
    expect(componentText).toMatch(/primaryPhoto/u);
    expect(componentText).toMatch(/gallery/u);
    expect(componentText).toMatch(/mediaId/u);
    for (const field of ["agencyFeeAmountMinor", "cleaningFeeAmountMinor", "securityDepositAmountMinor", "minimumStayNights"]) {
      expect(componentText).toContain(field);
    }
  });

  it("validates strict whitelist DTOs and rejects authoritative fields", () => {
    expect(ListPublicPropertiesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListPublicPropertiesQuerySchema.safeParse({ limit: 50, type: "HOUSE", transactionType: "SALE" }).success).toBe(true);
    for (const invalid of [{ tenantId: PROPERTY_ID }, { status: "PUBLISHED" }, { search: "Lagune" }, { availableOnly: true }, { limit: 51 }]) {
      expect(ListPublicPropertiesQuerySchema.safeParse(invalid).success).toBe(false);
    }
    const summary = {
      publicPropertyId: PROPERTY_ID,
      title: "Maison",
      propertyType: "HOUSE",
      transactionType: "SALE",
      structuralRole: "STANDALONE",
      location: { country: "CI", city: "Abidjan", district: "Cocody" },
      commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1, agencyFeeAmountMinor: 0 },
      primaryPhoto: null,
      publishedAt: "2026-08-31T10:00:00.000Z",
    };
    expect(PublicPropertyCatalogResponseSchema.safeParse({ items: [summary], pageInfo: { nextCursor: null, hasNextPage: false } }).success).toBe(true);
    const detail = { ...summary, description: null, details: { rooms: 4 }, gallery: [], amenities: [] };
    expect(PublicPropertyDetailSchema.safeParse(detail).success).toBe(true);
    expect(PublicPropertyDetailSchema.safeParse({ ...detail, tenantId: PROPERTY_ID }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...detail, withdrawnAt: "2026-09-01T10:00:00.000Z" }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...detail, availabilityStatus: "AVAILABLE", occupancyStatus: "VACANT" }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...detail, location: { ...summary.location, addressLine: "privée" } }).success).toBe(false);
    expect(PublicPropertyDetailSchema.safeParse({ ...detail, commercialTerms: {
      kind: "SHORT_TERM_RENTAL", currency: "USD", rateAmountMinor: 0, pricingUnit: "NIGHT",
      cleaningFeeAmountMinor: 0, securityDepositAmountMinor: 0, minimumStayNights: 1,
    } }).success).toBe(true);
  });
});
