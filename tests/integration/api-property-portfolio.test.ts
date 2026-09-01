import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import {
  PropertyPortfolioResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { ListProperties, type PropertyPortfolioQuery } from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const item = {
  propertyId: PROPERTY, title: "Maison Lagune", propertyType: "HOUSE" as const,
  transactionType: "SALE" as const, status: "DRAFT" as const, structuralRole: "STANDALONE" as const,
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  createdAt: "2026-08-27T12:00:00.000Z", updatedAt: "2026-08-27T12:00:00.000Z",
};

describe("Property portfolio HTTP", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  const list = vi.fn<PropertyPortfolioQuery["list"]>();

  async function start(options: { authenticated?: boolean; grant?: boolean } = {}) {
    const authenticated = options.authenticated ?? true; const grant = options.grant ?? true;
    list.mockResolvedValue({ items: [item], nextCursor: { createdAt: item.createdAt, propertyId: PROPERTY } });
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => authenticated ? ({
        actorId: "actor", authorityId: "authority", grants: grant ? ["LIST_PROPERTIES"] : [], tenantIds: [TENANT],
      }) : undefined },
      listProperties: new ListProperties({ list }),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; list.mockReset(); });

  it.each([
    ["status=DRAFT", { status: "DRAFT" }],
    ["status=PUBLISHED", { status: "PUBLISHED" }],
    ["status=WITHDRAWN", { status: "WITHDRAWN" }],
    ["type=HOUSE", { propertyType: "HOUSE" }],
    ["search=Lagune", { search: "Lagune" }],
    ["limit=10", { limit: 10 }],
  ])("accepte et transmet la query %s", async (query, expected) => {
    await start(); const response = await fetch(`${baseUrl}/v1/properties?${query}`);
    expect(response.status).toBe(200);
    const body = PropertyPortfolioResponseSchema.parse(await response.json());
    expect(body.items).toEqual([item]); expect(body.pageInfo).toMatchObject({ hasNextPage: true });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, ...expected }));
  });

  it("accepte un curseur opaque émis par la page précédente", async () => {
    await start();
    const first = PropertyPortfolioResponseSchema.parse(await (await fetch(`${baseUrl}/v1/properties`)).json());
    const response = await fetch(`${baseUrl}/v1/properties?cursor=${encodeURIComponent(first.pageInfo.nextCursor!)}`);
    expect(response.status).toBe(200);
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({
      cursor: { createdAt: item.createdAt, propertyId: PROPERTY },
    }));
  });

  it.each(["limit=0", "limit=101", "limit=1.5", "status=ARCHIVED", "type=CASTLE", "search=", "cursor=not%2Ba%2Bcursor", `search=${"x".repeat(101)}`, `tenantId=${TENANT}`])(
    "retourne un Problem Details 400 pour %s", async (query) => {
      await start(); const response = await fetch(`${baseUrl}/v1/properties?${query}`);
      expect(response.status).toBe(400); expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
      expect(list).not.toHaveBeenCalled();
    },
  );

  it("distingue absence d’authentification et absence de grant", async () => {
    await start({ authenticated: false });
    let response = await fetch(`${baseUrl}/v1/properties`); expect(response.status).toBe(401);
    await application?.close(); application = undefined; await start({ grant: false });
    response = await fetch(`${baseUrl}/v1/properties`); expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
