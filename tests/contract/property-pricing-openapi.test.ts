import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CommercialTermsSchema,
  SetPropertyPricingRequestSchema,
  UpdatePropertyDetailsRequestSchema,
} from "../../apps/api/src/contracts/v1/properties/property.schema.js";

const artifact = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);

describe("Property pricing OpenAPI contract", () => {
  it("publishes the dedicated authenticated PUT operation with exact statuses", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const path = document.paths["/v1/properties/{propertyId}/pricing"];
    expect(path).toBeDefined();
    expect(Object.keys(path)).toEqual(["put"]);
    expect(path.put.operationId).toBe("setPropertyPricing");
    expect(path.put.security).toEqual([{ bearer: [] }]);
    expect(path.put.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "propertyId", in: "path", required: true,
        schema: expect.objectContaining({ format: "uuid" }),
      }),
    ]));
    expect(Object.keys(path.put.responses).sort()).toEqual(["200", "400", "401", "403", "404", "500"]);
    expect(path.put.responses["200"].headers).toMatchObject({
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    });
  });

  it("publishes XOF-only discriminated variants and advanced fields", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operation = document.paths["/v1/properties/{propertyId}/pricing"].put;
    const requestName = operation.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const requestWrapper = document.components.schemas[requestName];
    const pricingName = requestWrapper.$ref?.split("/").at(-1);
    const request = pricingName === undefined
      ? requestWrapper
      : document.components.schemas[pricingName];
    const serialized = JSON.stringify(request);
    for (const field of [
      "agencyFeeAmountMinor", "cleaningFeeAmountMinor", "securityDepositAmountMinor", "minimumStayNights",
      "LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE", "XOF",
    ]) expect(serialized).toContain(field);
    expect(serialized).not.toMatch(/EUR|USD/iu);
  });

  it("keeps legacy responses readable while strict writes reject them", () => {
    expect(CommercialTermsSchema.safeParse({
      kind: "SALE", currency: "EUR", salePriceAmountMinor: 0,
    }).success).toBe(true);
    expect(SetPropertyPricingRequestSchema.safeParse({
      kind: "SALE", currency: "EUR", salePriceAmountMinor: 0,
    }).success).toBe(false);
    expect(SetPropertyPricingRequestSchema.safeParse({
      kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45_000, pricingUnit: "NIGHT",
      cleaningFeeAmountMinor: 5_000, securityDepositAmountMinor: 100_000, minimumStayNights: 3,
    }).success).toBe(true);
    expect(SetPropertyPricingRequestSchema.safeParse({
      kind: "SALE", currency: "XOF", salePriceAmountMinor: 1, unexpected: true,
    }).success).toBe(false);
  });

  it("allows detail-only updates and only accepts an optional strict compatibility pricing payload", () => {
    expect(UpdatePropertyDetailsRequestSchema.safeParse({ details: { rooms: 3 } }).success).toBe(true);
    expect(UpdatePropertyDetailsRequestSchema.safeParse({
      details: { rooms: 3 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
    }).success).toBe(true);
    expect(UpdatePropertyDetailsRequestSchema.safeParse({
      details: { rooms: 3 }, commercialTerms: { kind: "SALE", currency: "EUR", salePriceAmountMinor: 1 },
    }).success).toBe(false);
  });
});
