import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  CreatePropertyClientRequestSchema, CreatePropertyContractRequestSchema, EndPropertyContractRequestSchema,
  PropertyContractResponseSchema, PropertyWorkspaceResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property-client-contract.schema.js";

const artifact = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);
const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Property client, contract and workspace OpenAPI contract", () => {
  it("publishes only the intended authenticated operations", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const operations = [
      ["/v1/property-clients", ["get", "post"]],
      ["/v1/property-clients/{clientId}", ["get"]],
      ["/v1/properties/{propertyId}/contracts", ["get", "post"]],
      ["/v1/properties/{propertyId}/contracts/{contractId}", ["get", "put"]],
      ["/v1/properties/{propertyId}/contracts/{contractId}/activate", ["post"]],
      ["/v1/properties/{propertyId}/contracts/{contractId}/end", ["post"]],
      ["/v1/properties/{propertyId}/contracts/{contractId}/cancel", ["post"]],
      ["/v1/properties/{propertyId}/workspace", ["get"]],
    ] as const;
    for (const [path, verbs] of operations) {
      expect(Object.keys(document.paths[path]).sort()).toEqual([...verbs].sort());
      for (const verb of verbs) expect(document.paths[path][verb].security).toEqual([{ bearer: [] }]);
    }
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}"]).not.toHaveProperty("delete");
    expect(document.paths["/v1/property-clients/{clientId}"]).not.toHaveProperty("delete");
  });

  it("publishes stable operation ids, success codes and lifecycle bodies", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    expect(document.paths["/v1/property-clients"].post.operationId).toBe("createPropertyClient");
    expect(document.paths["/v1/properties/{propertyId}/contracts"].post.operationId).toBe("createPropertyContract");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/activate"].post.operationId).toBe("activatePropertyContract");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/end"].post.operationId).toBe("endPropertyContract");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/cancel"].post.operationId).toBe("cancelPropertyContract");
    expect(document.paths["/v1/properties/{propertyId}/workspace"].get.operationId).toBe("retrievePropertyWorkspace");
    expect(document.paths["/v1/property-clients"].post.responses).toHaveProperty("201");
    expect(document.paths["/v1/properties/{propertyId}/contracts"].post.responses).toHaveProperty("201");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/activate"].post.responses).toHaveProperty("200");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/activate"].post).not.toHaveProperty("requestBody");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/cancel"].post).not.toHaveProperty("requestBody");
    expect(document.paths["/v1/properties/{propertyId}/contracts/{contractId}/end"].post.requestBody).toBeDefined();
  });

  it("keeps request and response schemas strict and capability-based", () => {
    expect(CreatePropertyClientRequestSchema.safeParse({ displayName: "Awa", tenantId: PROPERTY_ID }).success).toBe(false);
    expect(CreatePropertyContractRequestSchema.safeParse({
      clientId: CLIENT_ID, contractType: "LEASE", reference: "BAIL-1", startDate: "2026-10-01",
    }).success).toBe(true);
    expect(CreatePropertyContractRequestSchema.safeParse({
      clientId: CLIENT_ID, contractType: "LEASE", reference: "BAIL-1", status: "ACTIVE",
    }).success).toBe(false);
    expect(EndPropertyContractRequestSchema.safeParse({ endDate: "2026-12-31" }).success).toBe(true);
    expect(PropertyContractResponseSchema.safeParse({ tenantId: PROPERTY_ID }).success).toBe(false);
    expect(PropertyWorkspaceResponseSchema.safeParse({ grants: ["ADMIN"] }).success).toBe(false);
  });

  it("does not expose private client or contract fields from public catalog paths", async () => {
    const document = JSON.parse(await readFile(artifact, "utf8"));
    const publicPaths = Object.fromEntries(Object.entries(document.paths).filter(([path]) => path.startsWith("/v1/public-properties")));
    const serialized = JSON.stringify(publicPaths);
    expect(serialized).not.toContain("property-clients");
    expect(serialized).not.toContain("PropertyContract");
    expect(serialized).not.toContain("clientId");
  });
});
