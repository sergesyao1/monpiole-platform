import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import type { RentalOperationalLifecycleApi } from "../../apps/api/src/http/rental-operations/rental-operations.controller.js";
import { OperationalLifecycleConflictError, OperationalSourceNotFoundError, RentalOperationsForbiddenError } from "../../services/rental-operations/src/application/operational-lifecycle.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const LEASE = "22222222-2222-4222-8222-222222222222";
const OCCUPANCY = "33333333-3333-4333-8333-333333333333";
const AT = "2026-10-01T14:00:00.000Z";
const snapshot = { tenantId: TENANT, rentableAssetId: "44444444-4444-4444-8444-444444444444", mode: "LONG_TERM_RENTAL" as const,
  leaseId: LEASE, leaseStatus: "OCCUPIED" as const, occupancyId: OCCUPANCY, actualOccupancyStartedAt: AT };

describe("Rental operational lifecycle HTTP boundary", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  afterEach(async () => application?.close());

  async function start(grants: readonly ("RETRIEVE_RENTAL_OPERATIONS" | "MANAGE_RENTAL_OPERATIONS")[] = ["RETRIEVE_RENTAL_OPERATIONS", "MANAGE_RENTAL_OPERATIONS"]) {
    const execute = vi.fn(async (_input: Parameters<RentalOperationalLifecycleApi["startLease"]["execute"]>[0]) => snapshot);
    const closeBooking = vi.fn(async (_input: Parameters<RentalOperationalLifecycleApi["closeBooking"]["execute"]>[0]) => snapshot);
    const extendBooking = vi.fn(async (_input: Parameters<RentalOperationalLifecycleApi["extendBooking"]["execute"]>[0]) => snapshot);
    const list = vi.fn(async () => {
      if (!grants.includes("RETRIEVE_RENTAL_OPERATIONS")) throw new RentalOperationsForbiddenError();
      return [snapshot];
    });
    const inspection = { inspectionId: OCCUPANCY, tenantId: TENANT, rentableAssetId: snapshot.rentableAssetId, mode: "LONG_TERM_RENTAL" as const,
      type: "ENTRY" as const, source: { type: "LEASE" as const, id: LEASE }, occurredAt: AT, responsibleActorId: "operator", status: "COMPLETED" as const,
      conditionRecords: [], evidenceReferences: [] };
    const turnover = { occupancyId: OCCUPANCY, stayId: LEASE, bookingId: LEASE, rentableAssetId: snapshot.rentableAssetId,
      checkedOutAt: AT, cleaningBlockId: LEASE, cleaningStartsAt: AT, cleaningEndsAt: "2026-10-01T15:00:00.000Z", cleaningStatus: "ACTIVE" as const };
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => ({ actorId: "operator", authorityId: "authority", tenantIds: [TENANT], grants }) },
      rentalOperationalLifecycle: { list: { execute: list }, startLease: { execute }, startBooking: { execute: async () => snapshot },
        completeInspection: { execute: async () => inspection }, endOccupancy: { execute: async () => snapshot },
        checkout: { execute: async () => turnover }, completeCleaning: { execute: async () => turnover },
        cancelLease: { execute: async () => snapshot }, closeBooking: { execute: closeBooking },
        extendBooking: { execute: extendBooking }, renewLease: { execute: async () => snapshot }, extendCleaning: { execute: async () => turnover } },
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("Unable to bind test API");
    return { base: `http://127.0.0.1:${address.port}`, execute, list, closeBooking, extendBooking };
  }

  it("lists tenant operations without accepting a client tenant identifier", async () => {
    const { base, list } = await start();
    const response = await fetch(`${base}/v1/rental-operations?tenantId=attacker`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [snapshot] });
    expect(list).toHaveBeenCalledWith({ authority: expect.objectContaining({ tenantIds: [TENANT] }) });
  });

  it("validates and forwards exceptional booking commands without client tenant data", async () => {
    const { base, closeBooking, extendBooking } = await start();
    const booking = "55555555-5555-4555-8555-555555555555";
    expect((await fetch(`${base}/v1/rental-operations/bookings/${booking}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurredAt: AT, reason: "", outcome: "NO_SHOW" }) })).status).toBe(400);
    expect((await fetch(`${base}/v1/rental-operations/bookings/${booking}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurredAt: AT, reason: "Voyageur absent", outcome: "NO_SHOW" }) })).status).toBe(200);
    expect(closeBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingId: booking, outcome: "NO_SHOW", authority: expect.objectContaining({ tenantIds: [TENANT] }) }));
    expect((await fetch(`${base}/v1/rental-operations/bookings/${booking}/extend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurredAt: AT, newEndAt: "2026-10-07T10:00:00.000Z" }) })).status).toBe(200);
    expect(extendBooking.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
  });

  it("maps missing exceptional sources and lifecycle conflicts to the HTTP contract", async () => {
    const { base, closeBooking, extendBooking } = await start();
    const booking = "55555555-5555-4555-8555-555555555555";
    closeBooking.mockRejectedValueOnce(new OperationalSourceNotFoundError());
    expect((await fetch(`${base}/v1/rental-operations/bookings/${booking}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurredAt: AT, reason: "Absent", outcome: "NO_SHOW" }) })).status).toBe(404);
    extendBooking.mockRejectedValueOnce(new OperationalLifecycleConflictError());
    expect((await fetch(`${base}/v1/rental-operations/bookings/${booking}/extend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurredAt: AT, newEndAt: "2026-10-07T10:00:00.000Z" }) })).status).toBe(409);
  });

  it("requires authentication and the retrieval grant", async () => {
    const unauthenticated = await createApiApplication({ logger: false }, {});
    application = unauthenticated;
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("Unable to bind test API");
    expect((await fetch(`http://127.0.0.1:${address.port}/v1/rental-operations`)).status).toBe(401);
    await application.close(); application = undefined;
    const { base } = await start([]);
    expect((await fetch(`${base}/v1/rental-operations`)).status).toBe(403);
  });

  it("validates start commands and forwards only authenticated authority", async () => {
    const { base, execute } = await start();
    expect((await fetch(`${base}/v1/rental-operations/leases/${LEASE}/occupancies`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occupancyId: "bad", occurredAt: AT }),
    })).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
    const response = await fetch(`${base}/v1/rental-operations/leases/${LEASE}/occupancies`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occupancyId: OCCUPANCY, occurredAt: AT }),
    });
    expect(response.status).toBe(200);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ leaseId: LEASE, occupancyId: OCCUPANCY, authority: { tenantIds: [TENANT] } });
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
  });
});
