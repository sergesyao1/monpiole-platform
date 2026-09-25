import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { PropertyOwnerDirectoryResponseSchema } from "../../apps/api/src/contracts/v1/properties/property-owner.schema.js";
import { ListPropertyOwners, type PropertyOwnerDirectoryQuery } from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const item = {
  ownerId: OWNER, identity: { ownerType: "INDIVIDUAL" as const, firstName: "Awa", lastName: "Kouassi" },
  contactInformation: { email: "awa@example.test" },
  createdAt: "2026-08-28T12:00:00.000Z", updatedAt: "2026-08-28T12:00:00.000Z",
};

describe("Property owner directory HTTP", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const list = vi.fn<PropertyOwnerDirectoryQuery["list"]>();

  async function start(options: { authenticated?: boolean; grant?: boolean } = {}) {
    list.mockResolvedValue({ items: [item], nextCursor: { createdAt: item.createdAt, ownerId: OWNER } });
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => options.authenticated === false ? undefined : ({
        actorId: "actor", authorityId: "authority", grants: options.grant === false ? [] : ["LIST_PROPERTY_OWNERS"], tenantIds: [TENANT],
      }) },
      listPropertyOwners: new ListPropertyOwners({ list }),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; list.mockReset(); });

  it.each([["limit=10", { limit: 10 }], ["search=Kouassi", { search: "Kouassi" }]])(
    "accepte et transmet %s", async (query, expected) => {
      await start(); const response = await fetch(`${baseUrl}/v1/property-owners?${query}`);
      expect(response.status).toBe(200);
      const body = PropertyOwnerDirectoryResponseSchema.parse(await response.json());
      expect(body.items[0]).toMatchObject({ ownerId: OWNER, ownerType: "INDIVIDUAL", firstName: "Awa" });
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, ...expected }));
    },
  );

  it("accepte un curseur émis par la page précédente", async () => {
    await start();
    const first = PropertyOwnerDirectoryResponseSchema.parse(await (await fetch(`${baseUrl}/v1/property-owners`)).json());
    const response = await fetch(`${baseUrl}/v1/property-owners?cursor=${encodeURIComponent(first.pageInfo.nextCursor!)}`);
    expect(response.status).toBe(200);
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { createdAt: item.createdAt, ownerId: OWNER } }));
  });

  it.each(["limit=0", "limit=101", "limit=1.5", "search=", "cursor=not%2Ba%2Bcursor", `search=${"x".repeat(101)}`, `tenantId=${TENANT}`])(
    "retourne un Problem Details 400 pour %s", async (query) => {
      await start(); const response = await fetch(`${baseUrl}/v1/property-owners?${query}`);
      expect(response.status).toBe(400); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
      expect(list).not.toHaveBeenCalled();
    },
  );

  it("distingue 401 et 403", async () => {
    await start({ authenticated: false });
    expect((await fetch(`${baseUrl}/v1/property-owners`)).status).toBe(401);
    await application?.close(); application = undefined; await start({ grant: false });
    expect((await fetch(`${baseUrl}/v1/property-owners`)).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
