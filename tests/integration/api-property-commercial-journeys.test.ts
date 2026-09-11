import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ListPropertyCommercialJourneys } from "../../services/property-management/src/index.js";
import type { PropertyCommercialJourneyPage } from "../../services/property-management/src/index.js";
import type { AuthorityGrant } from "../../apps/api/src/http/authenticated-authority/authenticated-authority.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INQUIRY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-09-11T10:00:00.000Z";

describe("Property commercial journeys HTTP", () => {
  let app: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  afterEach(() => app?.close());

  async function start(grants: readonly AuthorityGrant[] = ["LIST_PROPERTY_INQUIRIES"]) {
    const page: PropertyCommercialJourneyPage = {
      items: [{ inquiryId: INQUIRY, propertyId: PROPERTY, propertyTitle: "Villa Riviera", contactName: "Koffi Jean", stage: "NEW_INQUIRY", nextAction: "ACKNOWLEDGE", relevantAt: NOW, workspaceAnchor: "property-inquiries" }],
      nextCursor: { relevantAt: NOW, inquiryId: INQUIRY },
    };
    const list = vi.fn(async () => page);
    app = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => ({ actorId: "actor", authorityId: "authority", tenantIds: [TENANT], grants }) },
      listPropertyCommercialJourneys: new ListPropertyCommercialJourneys({ list }),
    });
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("bind");
    return { url: `http://127.0.0.1:${address.port}/v1/property-commercial-journeys`, list };
  }

  it("returns a tenant-authorized, paginated read projection", async () => {
    const { url, list } = await start();
    const response = await fetch(`${url}?limit=10`);
    expect(response.status).toBe(200);
    const body = await response.json() as { items: unknown[]; pageInfo: { nextCursor: string } };
    expect(body.items).toHaveLength(1);
    expect(body.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(list).toHaveBeenCalledWith(TENANT, 10, undefined);
  });

  it("returns an empty global collection without requiring a property id", async () => {
    const { url, list } = await start();
    list.mockResolvedValueOnce({ items: [] });
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
    expect(list).toHaveBeenCalledWith(TENANT, 20, undefined);
  });

  it("rejects invalid input, invalid cursors, and missing authorization", async () => {
    let fixture = await start();
    expect((await fetch(`${fixture.url}?limit=0`)).status).toBe(400);
    expect((await fetch(`${fixture.url}?cursor=not-a-cursor`)).status).toBe(400);
    await app?.close(); app = undefined;
    fixture = await start([]);
    expect((await fetch(fixture.url)).status).toBe(403);
  });
});
