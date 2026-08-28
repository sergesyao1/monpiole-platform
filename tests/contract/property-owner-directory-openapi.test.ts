import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  ListPropertyOwnersQuerySchema, PropertyOwnerDirectoryResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property-owner.schema.js";

const path = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);

describe("Property owner directory OpenAPI", () => {
  it("publie une collection privée bornée sans tenant client", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const listing = document.paths["/v1/property-owners"]?.get;
    expect(listing).toBeDefined(); expect(listing.operationId).toBe("listPropertyOwners");
    expect(listing.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(listing.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "500"]));
    const parameters = Object.fromEntries(listing.parameters.map((parameter: { name: string }) => [parameter.name, parameter]));
    expect(Object.keys(parameters)).toEqual(expect.arrayContaining(["limit", "cursor", "search"]));
    expect(parameters).not.toHaveProperty("tenantId");
    expect(parameters.limit.schema).toMatchObject({ minimum: 1, maximum: 100, default: 20 });
    const responseRef = listing.responses["200"].content["application/json"].schema.$ref.split("/").at(-1);
    expect(JSON.stringify(document.components.schemas[responseRef])).not.toContain("tenantId");
  });

  it("valide strictement query et réponse", () => {
    expect(ListPropertyOwnersQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListPropertyOwnersQuerySchema.safeParse({ limit: 100, search: "Kouassi" }).success).toBe(true);
    for (const query of [{ limit: 0 }, { limit: 101 }, { search: "" }, { tenantId: "x" }]) {
      expect(ListPropertyOwnersQuerySchema.safeParse(query).success).toBe(false);
    }
    expect(PropertyOwnerDirectoryResponseSchema.safeParse({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }).success).toBe(true);
  });
});
