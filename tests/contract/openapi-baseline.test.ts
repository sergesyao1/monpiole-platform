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
});
