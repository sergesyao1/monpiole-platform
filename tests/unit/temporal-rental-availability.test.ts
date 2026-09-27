import { describe, expect, it } from "vitest";

import {
  CheckRentalAvailability,
  findNextAvailableAt,
  intervalsOverlap,
  type AvailabilityConflict,
  type AvailabilityQueryPort,
} from "../../services/rental-operations/src/index.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const at = (day: number, hour = 0) => `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const conflict = (start: number, end?: number, kind: AvailabilityConflict["kind"] = "ALLOCATION"): AvailabilityConflict => ({
  conflictId: `${String(start).padStart(8, "0")}-0000-4000-8000-000000000000`,
  kind,
  startsAt: at(start),
  ...(end === undefined ? {} : { endsAt: at(end) }),
});

function checker(conflicts: readonly AvailabilityConflict[], effectiveLongTerm = false) {
  const queries: AvailabilityQueryPort = {
    listActiveConflicts: async () => conflicts,
    hasEffectiveLongTermOccupancy: async () => effectiveLongTerm,
  };
  return new CheckRentalAvailability(queries, {
    resolve: async () => ({ rentableAssetId: assetId, conflictScopeIds: [assetId] }),
  });
}

async function decision(
  conflicts: readonly AvailabilityConflict[],
  starts: number,
  ends: number,
  effectiveLongTerm = false,
) {
  return checker(conflicts, effectiveLongTerm).execute({
    tenantId,
    rentableAssetId: assetId,
    rentalMode: effectiveLongTerm ? "LONG_TERM_RENTAL" : "SHORT_TERM_RENTAL",
    requestedInterval: { startsAt: at(starts), endsAt: at(ends) },
    evaluatedAt: at(1),
  });
}

describe("half-open temporal availability", () => {
  it.each([
    ["after an existing booking", 16, 20],
    ["before a future booking", 1, 9],
    ["at an adjacent boundary", 15, 20],
  ])("is available %s", async (_label, starts, ends) => {
    expect((await decision([conflict(10, 15)], starts, ends)).available).toBe(true);
  });

  it("rejects a short-term overlap", async () => {
    expect(await decision([conflict(10, 15)], 12, 18)).toMatchObject({
      available: false,
      catalogDisposition: "UNAVAILABLE_FOR_INTERVAL",
    });
  });

  it("keeps a gap between bookings available", async () => {
    expect((await decision([conflict(10, 15), conflict(20, 25)], 16, 19)).available).toBe(true);
  });

  it("lets an operational block close an otherwise free gap", async () => {
    expect((await decision([
      conflict(10, 15),
      conflict(15, 17, "OPERATIONAL_BLOCK"),
    ], 16, 19)).available).toBe(false);
  });

  it("is available at the exact end of an operational block", async () => {
    expect((await decision([
      conflict(10, 15),
      conflict(15, 17, "OPERATIONAL_BLOCK"),
    ], 17, 20)).available).toBe(true);
  });

  it("supports multiple future non-overlapping bookings", async () => {
    const conflicts = [conflict(10, 15), conflict(20, 24), conflict(28, 30)];
    expect((await decision(conflicts, 5, 9)).available).toBe(true);
    expect((await decision(conflicts, 16, 19)).available).toBe(true);
    expect((await decision(conflicts, 25, 27)).available).toBe(true);
  });

  it("removes an effectively occupied long-term asset from the rental catalog", async () => {
    expect(await decision([conflict(1)], 10, 15, true)).toMatchObject({
      available: false,
      catalogDisposition: "REMOVE_FROM_RENTAL_CATALOG",
    });
  });

  it("removes effective long-term occupancy from catalog even for a short-term query", async () => {
    expect(await checker([], true).execute({
      tenantId,
      rentableAssetId: assetId,
      rentalMode: "SHORT_TERM_RENTAL",
      requestedInterval: { startsAt: at(20), endsAt: at(25) },
      evaluatedAt: at(1),
    })).toMatchObject({
      available: false,
      catalogDisposition: "REMOVE_FROM_RENTAL_CATALOG",
    });
  });

  it("treats an open-ended allocation as conflicting with every later interval", () => {
    expect(intervalsOverlap(at(20), at(25), at(10), undefined)).toBe(true);
  });

  it("finds the first gap rather than the maximum allocation end", () => {
    expect(findNextAvailableAt(
      { startsAt: at(10), endsAt: at(13) },
      [conflict(10, 17), conflict(20, 24)],
    )).toBe(at(17));
  });
});
