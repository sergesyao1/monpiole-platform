import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CreatePropertyRequestSchema, ListPropertiesQuerySchema, PropertyPortfolioResponseSchema, UpdatePropertyDetailsRequestSchema,
  UpdatePropertyCoreInformationRequestSchema, PropertyResponseSchema,
  PropertyPhotoGalleryResponseSchema,
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
  it("publishes the bodyless, authenticated and idempotent Property publication contract", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const publication = document.paths["/v1/properties/{propertyId}/publication"]?.put;
    expect(publication).toBeDefined();
    expect(publication.operationId).toBe("publishProperty");
    expect(publication.security).toEqual([{ bearer: [] }]);
    expect(publication).not.toHaveProperty("requestBody");
    expect(Object.keys(publication.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "409", "500"]));
    expect(publication.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "propertyId", in: "path", required: true, schema: expect.objectContaining({ format: "uuid" }) }),
    ]));
    const success = publication.responses["200"];
    expect(success.headers).toEqual(expect.objectContaining({ "X-Correlation-Id": expect.any(Object), "X-Request-Id": expect.any(Object) }));
    const responseRef = success.content["application/json"].schema.$ref.split("/").at(-1);
    const responseSchema = document.components.schemas[responseRef];
    const responseContract = JSON.stringify(responseSchema);
    expect(responseSchema.oneOf ?? responseSchema.anyOf).toHaveLength(2);
    expect(responseContract).toContain("DRAFT");
    expect(responseContract).toContain("PUBLISHED");
    expect(responseContract).toContain("publishedAt");
    expect(publication.responses["409"].content).toHaveProperty("application/problem+json");
  });
  it("publishes authenticated gallery, atomic primary selection and guarded deletion contracts", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const gallery = document.paths["/v1/properties/{propertyId}/photos"]?.get;
    const registration = document.paths["/v1/properties/{propertyId}/photos"]?.post;
    const content = document.paths["/v1/properties/{propertyId}/photos/{photoId}/content"]?.get;
    const selection = document.paths["/v1/properties/{propertyId}/photos/{photoId}/primary"]?.put;
    const deletion = document.paths["/v1/properties/{propertyId}/photos/{photoId}"]?.delete;
    expect(gallery?.operationId).toBe("listPropertyPhotos");
    expect(registration?.operationId).toBe("registerPropertyPhoto");
    expect(content?.operationId).toBe("retrievePropertyPhotoContent");
    expect(selection?.operationId).toBe("selectPropertyPrimaryPhoto");
    expect(deletion?.operationId).toBe("deletePropertyPhoto");
    for (const operation of [gallery, registration, content, selection, deletion]) expect(operation.security).toEqual([{ bearer: [] }]);
    expect(registration.requestBody.content["application/json"]).toBeDefined();
    expect(Object.keys(content.responses["200"].content)).toEqual(expect.arrayContaining(["image/jpeg", "image/png", "image/webp"]));
    expect(selection).not.toHaveProperty("requestBody");
    expect(Object.keys(selection.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    expect(Object.keys(deletion.responses)).toEqual(expect.arrayContaining(["204", "400", "401", "403", "404", "409", "500"]));
    expect(selection.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "propertyId", required: true }),
      expect.objectContaining({ name: "photoId", required: true }),
    ]));
    expect(PropertyPhotoGalleryResponseSchema.safeParse({ photos: [{
      photoId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", category: "BUILDING_EXTERIOR_OR_ENTRANCE", status: "AVAILABLE",
      contentPath: "/v1/properties/cccccccc-cccc-4ccc-8ccc-cccccccccccc/photos/dddddddd-dddd-4ddd-8ddd-dddddddddddd/content",
      contentType: "image/png", contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
      registeredAt: "2026-08-30T10:00:00.000Z", availableAt: "2026-08-30T10:01:00.000Z",
    }] }).success).toBe(true);
  });
  it("publishes the tenant standard read/update contract", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const standard = document.paths["/v1/property-photo-standard"];
    expect(standard?.get?.operationId).toBe("retrievePropertyPhotoStandard");
    expect(standard?.put?.operationId).toBe("updatePropertyPhotoStandard");
    expect(standard.get.security).toEqual([{ bearer: [] }]);
    expect(standard.put.security).toEqual([{ bearer: [] }]);
  });
  it("requires an explicit subtype only for long-term rental Apartments", () => {
    const base = { title: "Bien", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" } };
    expect(CreatePropertyRequestSchema.safeParse({ ...base, propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL" }).success).toBe(false);
    expect(CreatePropertyRequestSchema.safeParse({ ...base, propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO" }).success).toBe(true);
    expect(CreatePropertyRequestSchema.safeParse({ ...base, propertyType: "HOUSE", transactionType: "SALE", apartmentSubtype: "MULTI_ROOM" }).success).toBe(false);
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
    expect(ListPropertiesQuerySchema.safeParse({ status: "PUBLISHED" }).success).toBe(true);
    for (const query of [{ limit: 0 }, { limit: 101 }, { status: "ARCHIVED" }, { type: "CASTLE" }, { tenantId: "x" }]) {
      expect(ListPropertiesQuerySchema.safeParse(query).success).toBe(false);
    }
    expect(PropertyPortfolioResponseSchema.safeParse({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }).success).toBe(true);
  });
  it("validates DRAFT and PUBLISHED Property representations as a closed discriminated union", () => {
    const base = { propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Maison", propertyType: "HOUSE", transactionType: "SALE",
      structuralRole: "STANDALONE", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T14:00:00.000Z", photos: [] };
    expect(PropertyResponseSchema.safeParse({ ...base, status: "DRAFT" }).success).toBe(true);
    expect(PropertyResponseSchema.safeParse({ ...base, status: "DRAFT", publishedAt: "2026-08-25T14:00:00.000Z" }).success).toBe(false);
    expect(PropertyResponseSchema.safeParse({ ...base, status: "PUBLISHED" }).success).toBe(false);
    expect(PropertyResponseSchema.safeParse({ ...base, status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z" }).success).toBe(true);
  });
});
