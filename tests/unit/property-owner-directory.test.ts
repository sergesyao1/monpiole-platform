import { describe, expect, it, vi } from "vitest";

import {
  InvalidPropertyOwnerDirectoryQueryError, ListPropertyOwners, PropertyForbiddenError,
  type PropertyOwnerDirectoryQuery,
} from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authority = { actorId: "actor", authorityId: "authority", grants: ["LIST_PROPERTY_OWNERS"] as const, tenantIds: [TENANT] };

describe("ListPropertyOwners", () => {
  it("applique les valeurs par défaut", async () => {
    const list = vi.fn(async () => ({ items: [] }));
    await expect(new ListPropertyOwners({ list }).execute({ authority })).resolves.toEqual({ items: [] });
    expect(list).toHaveBeenCalledWith({ tenantId: TENANT, limit: 20 });
  });

  it("normalise la recherche et transmet le curseur opaque applicatif", async () => {
    const cursor = { createdAt: "2026-08-28T10:00:00.000Z", ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const directory: PropertyOwnerDirectoryQuery = { list: vi.fn(async () => ({ items: [], nextCursor: cursor })) };
    await new ListPropertyOwners(directory).execute({ authority, limit: 100, cursor, search: "  Kouassi  " });
    expect(directory.list).toHaveBeenCalledWith({ tenantId: TENANT, limit: 100, cursor, search: "Kouassi" });
  });

  it.each([
    ["limit", { limit: 0 }], ["limit", { limit: 101 }], ["limit", { limit: 1.5 }],
    ["search", { search: "   " }], ["search", { search: "x".repeat(101) }],
  ] as const)("rejette le paramètre invalide %s", async (field, value) => {
    await expect(new ListPropertyOwners({ list: vi.fn() }).execute({ authority, ...value }))
      .rejects.toMatchObject({ constructor: InvalidPropertyOwnerDirectoryQueryError, field });
  });

  it("exige LIST_PROPERTY_OWNERS et un tenant unique", async () => {
    const useCase = new ListPropertyOwners({ list: vi.fn() });
    await expect(useCase.execute({ authority: { ...authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(useCase.execute({ authority: { ...authority, tenantIds: [TENANT, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] } }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
  });
});
