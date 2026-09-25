import { describe, expect, it, vi } from "vitest";

import {
  InvalidPropertyPortfolioQueryError, ListProperties, PropertyForbiddenError,
  type PropertyPortfolioQuery,
} from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const authority = { actorId: "actor", authorityId: "authority", grants: ["LIST_PROPERTIES"] as const, tenantIds: [TENANT] };

describe("ListProperties", () => {
  it("applique les valeurs par défaut et retourne une page vide", async () => {
    const list = vi.fn(async () => ({ items: [] }));
    await expect(new ListProperties({ list }).execute({ authority })).resolves.toEqual({ items: [] });
    expect(list).toHaveBeenCalledWith({ tenantId: TENANT, limit: 20 });
  });

  it("transmet filtres, recherche normalisée et curseur au port", async () => {
    const cursor = { createdAt: "2026-08-27T10:00:00.000Z", propertyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const portfolio: PropertyPortfolioQuery = { list: vi.fn(async () => ({ items: [], nextCursor: cursor })) };
    await new ListProperties(portfolio).execute({
      authority, limit: 100, cursor, status: "DRAFT", propertyType: "HOUSE", search: "  Lagune  ", ownerId: OWNER,
    });
    expect(portfolio.list).toHaveBeenCalledWith({
      tenantId: TENANT, limit: 100, cursor, status: "DRAFT", propertyType: "HOUSE", search: "Lagune", ownerId: OWNER,
    });
  });

  it.each([
    ["limit", { limit: 0 }], ["limit", { limit: 101 }], ["limit", { limit: 1.5 }],
    ["search", { search: "   " }], ["search", { search: "x".repeat(101) }],
    ["status", { status: "ARCHIVED" }], ["type", { propertyType: "CASTLE" }],
    ["ownerId", { ownerId: "not-an-owner" }],
  ] as const)("rejette le paramètre applicatif invalide %s", async (field, value) => {
    const useCase = new ListProperties({ list: vi.fn() });
    await expect(useCase.execute({ authority, ...value } as never)).rejects.toMatchObject({
      constructor: InvalidPropertyPortfolioQueryError, field,
    });
  });

  it("exige explicitement LIST_PROPERTIES et un tenant unique", async () => {
    const useCase = new ListProperties({ list: vi.fn() });
    await expect(useCase.execute({ authority: { ...authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(useCase.execute({ authority: { ...authority, tenantIds: [TENANT, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
  });
});
