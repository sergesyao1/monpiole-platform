import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ListPropertiesQuerySchema, PropertyPortfolioResponseSchema, UpdatePropertyDetailsRequestSchema,
  UpdatePropertyCoreInformationRequestSchema,
} from "../../apps/api/src/contracts/v1/properties/property.schema.js";

const path = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);
describe("Property OpenAPI contract", () => {
  it("publishes authenticated create/retrieve contracts without authoritative server fields", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const create = document.paths["/v1/properties"]?.post; const retrieve = document.paths["/v1/properties/{propertyId}"]?.get;
    expect(create).toBeDefined(); expect(retrieve).toBeDefined();
    expect(create.security).toEqual([{ bearer: [] }]); expect(retrieve.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(create.responses)).toEqual(expect.arrayContaining(["201", "400", "401", "403", "500"]));
    expect(Object.keys(retrieve.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    const parameter = retrieve.parameters.find((item: { name: string }) => item.name === "propertyId"); expect(parameter.required).toBe(true);
    const requestRef = create.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const requestSchema = document.components.schemas[requestRef];
    expect(requestSchema.required).toEqual(expect.arrayContaining(["title", "propertyType", "transactionType", "location"]));
    expect(requestSchema.properties).not.toHaveProperty("tenantId"); expect(requestSchema.properties).not.toHaveProperty("status"); expect(requestSchema.properties).not.toHaveProperty("propertyId");
    expect(requestSchema.additionalProperties).toBe(false);
  });
  it("publishes a discriminated authenticated details update contract", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const update = document.paths["/v1/properties/{propertyId}/details"]?.put;
    expect(update).toBeDefined(); expect(update.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(update.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    const requestRef = update.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const request = document.components.schemas[requestRef];
    expect(request.required).toEqual(expect.arrayContaining(["details", "commercialTerms"]));
    expect(request.properties).not.toHaveProperty("tenantId");
    const terms = request.properties.commercialTerms;
    expect(terms.oneOf ?? terms.anyOf).toHaveLength(3);
    const serialized = JSON.stringify(terms);
    for (const kind of ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]) expect(serialized).toContain(kind);
  });
  it("publishes a strict authenticated core information update contract", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const update = document.paths["/v1/properties/{propertyId}"]?.put;
    expect(update).toBeDefined(); expect(update.operationId).toBe("updatePropertyCoreInformation");
    expect(update.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(update.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    const requestRef = update.requestBody.content["application/json"].schema.$ref.split("/").at(-1);
    const request = document.components.schemas[requestRef];
    expect(request.required).toEqual(expect.arrayContaining(["title", "location"]));
    expect(request.properties).not.toHaveProperty("tenantId");
    expect(request.properties).not.toHaveProperty("propertyType");
    expect(request.properties).not.toHaveProperty("transactionType");
    expect(request.properties).not.toHaveProperty("status");
    expect(request.additionalProperties).toBe(false);
  });
  it("validates core information input with creation-equivalent bounds", () => {
    const valid = { title: "Villa", description: "Vue lagune", location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" } };
    expect(UpdatePropertyCoreInformationRequestSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [{ ...valid, title: " " }, { ...valid, title: "x".repeat(201) }, { ...valid, propertyType: "HOUSE" }, { ...valid, location: { ...valid.location, country: "CIV" } }]) {
      expect(UpdatePropertyCoreInformationRequestSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it("rejects mixed commercial variants and authoritative transport fields", () => {
    const base = { details: { rooms: 2 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 } };
    expect(UpdatePropertyDetailsRequestSchema.safeParse(base).success).toBe(true);
    expect(UpdatePropertyDetailsRequestSchema.safeParse({ ...base, commercialTerms: { ...base.commercialTerms, rentAmountMinor: 1 } }).success).toBe(false);
    expect(UpdatePropertyDetailsRequestSchema.safeParse({ ...base, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).success).toBe(false);
  });

  it("publishes the bounded private portfolio listing contract", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const listing = document.paths["/v1/properties"]?.get;
    expect(listing).toBeDefined(); expect(listing.operationId).toBe("listProperties");
    expect(listing.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(listing.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "500"]));
    const parameters = Object.fromEntries(listing.parameters.map((parameter: { name: string }) => [parameter.name, parameter]));
    expect(Object.keys(parameters)).toEqual(expect.arrayContaining(["limit", "cursor", "status", "type", "search"]));
    expect(parameters).not.toHaveProperty("tenantId");
    expect(parameters.limit.schema).toMatchObject({ minimum: 1, maximum: 100, default: 20 });
    const responseRef = listing.responses["200"].content["application/json"].schema.$ref.split("/").at(-1);
    const responseSchema = document.components.schemas[responseRef];
    expect(responseSchema.required).toEqual(expect.arrayContaining(["items", "pageInfo"]));
    expect(JSON.stringify(responseSchema)).not.toMatch(/commercialTerms|ownership|tenantId/);
  });

  it("validates portfolio query and response schemas strictly", () => {
    expect(ListPropertiesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListPropertiesQuerySchema.safeParse({ limit: 100, status: "DRAFT", type: "HOUSE", search: "Lagune" }).success).toBe(true);
    for (const query of [{ limit: 0 }, { limit: 101 }, { status: "PUBLISHED" }, { type: "CASTLE" }, { tenantId: "x" }]) {
      expect(ListPropertiesQuerySchema.safeParse(query).success).toBe(false);
    }
    expect(PropertyPortfolioResponseSchema.safeParse({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }).success).toBe(true);
  });
});
