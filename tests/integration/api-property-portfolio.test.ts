import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import {
  PropertyPortfolioResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { ListProperties, type PropertyPortfolioQuery } from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const item = {
  propertyId: PROPERTY, title: "Maison Lagune", propertyType: "HOUSE" as const,
  transactionType: "SALE" as const, status: "DRAFT" as const, structuralRole: "STANDALONE" as const,
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  createdAt: "2026-08-27T12:00:00.000Z", updatedAt: "2026-08-27T12:00:00.000Z",
  photoCount: 0,
  owner: { ownerId: OWNER, displayName: "Blaise Koffi", phoneNumber: "+2250748123456", email: "blaise@example.ci", additionalOwnerCount: 1 },
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
    [`ownerId=${OWNER}`, { ownerId: OWNER }],
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

  it("expose le résumé hiérarchique du portefeuille sans perte dans la réponse HTTP", async () => {
    await start();

    const buildingItem = {
      ...item,
      title: "Immeuble Horizon",
      propertyType: "BUILDING" as const,
      transactionType: "LONG_TERM_RENTAL" as const,
      structuralRole: "COMPOSITE" as const,
      contentSummary: {
        buildingCount: 0,
        composition: {
          totalUnitCount: 3,
          unitsByType: [
            { propertyType: "APARTMENT" as const, totalCount: 2 },
            { propertyType: "SHOP" as const, totalCount: 1 },
          ],
        },
        availability: {
          totalCount: 3,
          configuredCount: 3,
          availableCount: 2,
          unavailableCount: 1,
          vacantCount: 2,
          occupiedCount: 1,
          byType: [
            {
              propertyType: "APARTMENT" as const,
              totalCount: 2,
              configuredCount: 2,
              availableCount: 1,
              unavailableCount: 1,
              vacantCount: 1,
              occupiedCount: 1,
            },
            {
              propertyType: "SHOP" as const,
              totalCount: 1,
              configuredCount: 1,
              availableCount: 1,
              unavailableCount: 0,
              vacantCount: 1,
              occupiedCount: 0,
            },
          ],
        },
        contracts: {
          totalCount: 3,
          activeCount: 2,
        },
      },
    };

    list.mockResolvedValueOnce({
      items: [buildingItem],
      nextCursor: undefined,
    });

    const response = await fetch(`${baseUrl}/v1/properties`);

    expect(response.status).toBe(200);

    const body = PropertyPortfolioResponseSchema.parse(await response.json());

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.contentSummary).toEqual(buildingItem.contentSummary);
    expect(body.items[0]?.contentSummary?.buildingCount).toBe(0);
    expect(body.items[0]?.contentSummary?.composition.unitsByType).toEqual([
      { propertyType: "APARTMENT", totalCount: 2 },
      { propertyType: "SHOP", totalCount: 1 },
    ]);
    expect(body.items[0]?.contentSummary?.availability.byType).toEqual([
      {
        propertyType: "APARTMENT",
        totalCount: 2,
        configuredCount: 2,
        availableCount: 1,
        unavailableCount: 1,
        vacantCount: 1,
        occupiedCount: 1,
      },
      {
        propertyType: "SHOP",
        totalCount: 1,
        configuredCount: 1,
        availableCount: 1,
        unavailableCount: 0,
        vacantCount: 1,
        occupiedCount: 0,
      },
    ]);
    expect(body.items[0]?.contentSummary?.contracts).toEqual({
      totalCount: 3,
      activeCount: 2,
    });
  });
  it.each(["limit=0", "limit=101", "limit=1.5", "status=ARCHIVED", "type=CASTLE", "search=", "ownerId=foreign", "cursor=not%2Ba%2Bcursor", `search=${"x".repeat(101)}`, `tenantId=${TENANT}`])(
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
