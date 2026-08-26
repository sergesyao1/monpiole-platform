import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
});
