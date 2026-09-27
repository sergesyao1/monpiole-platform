import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { AllowlistedPublicCatalogTenantResolver } from "../../apps/api/src/configuration/public-catalog.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROPERTY = "22222222-2222-4222-8222-222222222222";
const START = "2026-10-10T14:00:00.000Z";
const END = "2026-10-15T11:00:00.000Z";

const available = {
  propertyId: PROPERTY,
  rentalMode: "SHORT_TERM_RENTAL" as const,
  availabilityStatus: "AVAILABLE" as const,
  rentableNow: true,
  requestedPeriod: { startsAt: START, endsAt: END },
  requestedPeriodAvailable: true,
  nextAvailability: START,
  evaluatedAt: "2026-09-27T12:00:00.000Z",
  catalogDisposition: "AVAILABLE_FOR_INTERVAL" as const,
};

describe("Rental availability HTTP boundary", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  afterEach(async () => application?.close());

  async function start(composition: Parameters<typeof createApiApplication>[1]) {
    application = await createApiApplication({ logger: false }, composition);
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("Unable to bind test API");
    return `http://127.0.0.1:${address.port}`;
  }

  it("serves sanitized public availability for the host-resolved tenant", async () => {
    const execute = vi.fn(async () => available);
    const hosts = new Map<string, string>();
    const base = await start({
      publicCatalogTenantResolver: new AllowlistedPublicCatalogTenantResolver(hosts),
      retrievePublicRentalAvailability: { execute },
    });
    hosts.set(new URL(base).host, TENANT);
    const response = await fetch(`${base}/v1/public/properties/${PROPERTY}/rental-availability?startsAt=${START}&endsAt=${END}`, {
      headers: { host: new URL(base).host },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toEqual(available);
    expect(JSON.stringify(body)).not.toMatch(/allocationId|bookingId|clientId|note|sourceId/u);
    expect(execute).toHaveBeenCalledWith({ tenantId: TENANT, propertyId: PROPERTY, startsAt: START, endsAt: END });
  });

  it("rejects invalid periods before invoking public availability", async () => {
    const execute = vi.fn(async () => available);
    const hosts = new Map<string, string>();
    const base = await start({
      publicCatalogTenantResolver: new AllowlistedPublicCatalogTenantResolver(hosts),
      retrievePublicRentalAvailability: { execute },
    });
    hosts.set(new URL(base).host, TENANT);
    const response = await fetch(`${base}/v1/public/properties/${PROPERTY}/rental-availability?startsAt=${END}&endsAt=${START}`, {
      headers: { host: "catalogue.test" },
    });
    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires authentication for private availability", async () => {
    const base = await start({ retrievePrivateRentalAvailability: { execute: async () => available } });
    const response = await fetch(`${base}/v1/properties/${PROPERTY}/rental-availability?startsAt=${START}&endsAt=${END}`);
    expect(response.status).toBe(401);
  });

  it("derives private tenant authority from authentication", async () => {
    const execute = vi.fn(async (_input: unknown) => ({ ...available, conflictTypes: ["OPERATIONAL_BLOCK" as const] }));
    const base = await start({
      authenticatedAuthorityProvider: {
        resolve: async () => ({ actorId: "actor", authorityId: "authority", tenantIds: [TENANT], grants: ["RETRIEVE_PROPERTY"] }),
      },
      retrievePrivateRentalAvailability: { execute },
    });
    const response = await fetch(`${base}/v1/properties/${PROPERTY}/rental-availability?startsAt=${START}&endsAt=${END}`);
    expect(response.status).toBe(200);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ propertyId: PROPERTY, startsAt: START, endsAt: END });
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
  });
});
