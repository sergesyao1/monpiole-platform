import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { createOpenApiDocument } from "../../apps/api/src/openapi/create-openapi-document.js";
import { serializeOpenApiDocument } from "../../apps/api/src/openapi/normalize-openapi-document.js";

describe("deterministic OpenAPI 3.1 contract", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  async function document() {
    application = await createApiApplication({ logger: false });
    await application.init();
    return createOpenApiDocument(application);
  }

  it("publishes the complete versioned baseline operation", async () => {
    const openapi = await document();
    expect(openapi.openapi).toBe("3.1.0");
    const operation = openapi.paths["/api/v1/contract-baseline"]?.post;
    expect(operation?.operationId).toBe("proveContractBaseline");
    expect(operation?.security).toEqual([]);
    expect(operation?.requestBody).toBeDefined();
    expect(operation?.responses["200"]).toBeDefined();
    expect(operation?.responses["400"]).toBeDefined();
    const badRequestResponse = operation?.responses["400"];
    if (badRequestResponse === undefined || "$ref" in badRequestResponse) {
      throw new Error("Expected an inline 400 response contract");
    }
    expect(badRequestResponse.content?.["application/problem+json"]?.schema).toEqual({
      $ref: "#/components/schemas/ProblemDetails",
    });
    const requestBody = operation?.requestBody;
    if (requestBody === undefined || "$ref" in requestBody) {
      throw new Error("Expected an inline request body contract");
    }
    expect(requestBody.content["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ContractBaselineRequest",
    });
    const parameterNames = (operation?.parameters ?? []).map((parameter) =>
      "$ref" in parameter ? parameter.$ref : parameter.name,
    );
    expect(parameterNames).toEqual(
      expect.arrayContaining([
        "X-Tenant-Id",
        "X-Correlation-Id",
        "Idempotency-Key",
      ]),
    );
    const schemaNames = Object.keys(openapi.components?.schemas ?? {});
    expect(schemaNames).toEqual(
      expect.arrayContaining([
        "ContractBaselineRequest",
        "ContractBaselineResponse",
        "ProblemDetails",
      ]),
    );
    const serialized = serializeOpenApiDocument(openapi);
    expect(serialized).not.toMatch(/aggregate|entity|persistence|repository/i);
  });

  it("normalizes repeated generation byte-for-byte", async () => {
    const first = serializeOpenApiDocument(await document());
    await application?.close();
    application = undefined;
    const second = serializeOpenApiDocument(await document());
    expect(second).toBe(first);
  });

  it("publishes the pre-tenant Create Tenant operation", async () => {
    const openapi = await document();
    const operation = openapi.paths["/api/v1/tenants"]?.post;
    expect(operation?.operationId).toBe("createTenant");
    expect(operation?.responses["201"]).toBeDefined();
    expect(operation?.responses["400"]).toBeDefined();
    expect(operation?.responses["403"]).toBeDefined();
    expect(operation?.responses["409"]).toBeDefined();
    expect(operation?.responses["500"]).toBeDefined();
    const names = (operation?.parameters ?? []).map((parameter) => "$ref" in parameter ? parameter.$ref : parameter.name);
    expect(names).toEqual(expect.arrayContaining(["X-Correlation-Id", "Idempotency-Key"]));
    expect(names).not.toContain("X-Tenant-Id");
  });

  it("matches the committed OpenAPI review artifact", async () => {
    const generated = serializeOpenApiDocument(await document());
    const committed = await readFile("engineering/contracts/http/openapi.json", "utf8");
    expect(generated).toBe(committed);
  });

  it("publishes the Bootstrap Tenant Administrator contract without credential fields", async () => {
    const openapi = await document();
    const operation = openapi.paths["/v1/tenants/{tenantId}/administrators/bootstrap"]?.post;
    expect(operation?.operationId).toBe("bootstrapTenantAdministrator");
    const tenantParameter = (operation?.parameters ?? []).find((parameter) => !("$ref" in parameter) && parameter.name === "tenantId");
    expect(tenantParameter).toMatchObject({ in: "path", required: true });
    expect(operation?.responses["201"]).toBeDefined();
    for (const status of ["400", "404", "409"]) {
      const response = operation?.responses[status];
      expect(response).toBeDefined();
      if (response === undefined || "$ref" in response) throw new Error(`Expected inline ${status} response`);
      expect(response.content?.["application/problem+json"]?.schema).toEqual({ $ref: "#/components/schemas/ProblemDetails" });
    }
    const requestSchema = openapi.components?.schemas?.["BootstrapAdministratorRequest"];
    expect(requestSchema).toMatchObject({ required: ["email", "firstName", "lastName"] });
    const publicContract = JSON.stringify({ operation, requestSchema, response: openapi.components?.schemas?.["BootstrapAdministratorResponse"] });
    expect(publicContract).not.toMatch(/password|passwordHash|temporaryPassword|secret|token/i);
  });

  it("publishes bodyless idempotent administrator activation", async () => {
    const openapi = await document();
    const operation = openapi.paths["/v1/tenants/{tenantId}/administrators/{administratorId}/activate"]?.post;
    expect(operation?.operationId).toBe("activateTenantAdministrator");
    expect(operation?.requestBody).toBeUndefined();
    expect(operation?.responses["200"]).toBeDefined();
    for (const status of ["400", "404"]) {
      const response = operation?.responses[status];
      expect(response).toBeDefined();
      if (response === undefined || "$ref" in response) throw new Error(`Expected inline ${status} response`);
      expect(response.content?.["application/problem+json"]?.schema).toEqual({ $ref: "#/components/schemas/ProblemDetails" });
    }
    const parameters = (operation?.parameters ?? []).filter((parameter) => !("$ref" in parameter));
    expect(parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "tenantId", in: "path", required: true }),
      expect.objectContaining({ name: "administratorId", in: "path", required: true }),
    ]));
  });
});
