import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AssignPropertyOwnerRequestSchema, PropertyOwnershipResponseSchema } from "../../apps/api/src/contracts/v1/properties/property-ownership.schema.js";

const path = new URL("../../engineering/contracts/http/openapi.json", import.meta.url);
describe("PropertyOwnership API contract", () => {
  it("publishes authenticated POST, GET and DELETE operations", async () => {
    const document = JSON.parse(await readFile(path, "utf8"));
    const collection = document.paths["/v1/properties/{propertyId}/owners"];
    const member = document.paths["/v1/properties/{propertyId}/owners/{ownerId}"];
    expect(collection?.post).toBeDefined(); expect(collection?.get).toBeDefined(); expect(member?.delete).toBeDefined();
    for (const operation of [collection.post, collection.get, member.delete]) expect(operation.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(collection.post.responses)).toEqual(expect.arrayContaining(["201", "400", "401", "403", "404", "409", "500"]));
    expect(Object.keys(collection.get.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    expect(Object.keys(member.delete.responses)).toEqual(expect.arrayContaining(["204", "400", "401", "403", "404", "500"]));
  });
  it("keeps requests strict and responses presentation-neutral", () => {
    expect(AssignPropertyOwnerRequestSchema.safeParse({ ownerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ownershipShare: 33.33 }).success).toBe(true);
    expect(AssignPropertyOwnerRequestSchema.safeParse({ ownerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ownershipShare: 33.333 }).success).toBe(false);
    expect(AssignPropertyOwnerRequestSchema.safeParse({ ownerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ownershipShare: 50, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).success).toBe(false);
    const response = PropertyOwnershipResponseSchema.parse({ propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", ownerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ownershipShare: 50, createdAt: "2026-08-26T12:00:00.000Z" });
    expect(response).not.toHaveProperty("tenantId"); expect(response).not.toHaveProperty("ownershipId");
  });
});
