import { describe, expect, it } from "vitest";

import {
  BOOKING_LIFECYCLE_TRANSITIONS,
  INSPECTION_LIFECYCLE_TRANSITIONS,
  LEASE_OPERATIONAL_TRANSITIONS,
  OCCUPANCY_LIFECYCLE_TRANSITIONS,
  STAY_LIFECYCLE_TRANSITIONS,
  canTransition,
} from "../../services/rental-operations/src/domain/operational-lifecycle-specification.js";

describe("Rental Operations lifecycle specification", () => {
  it("keeps booking terminal outcomes terminal and execution ordered", () => {
    expect(canTransition(BOOKING_LIFECYCLE_TRANSITIONS, "CONFIRMED", "IN_STAY")).toBe(true);
    expect(canTransition(BOOKING_LIFECYCLE_TRANSITIONS, "CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition(BOOKING_LIFECYCLE_TRANSITIONS, "CONFIRMED", "NO_SHOW")).toBe(true);
    expect(canTransition(BOOKING_LIFECYCLE_TRANSITIONS, "IN_STAY", "COMPLETED")).toBe(true);
    expect(BOOKING_LIFECYCLE_TRANSITIONS.COMPLETED).toEqual([]);
    expect(BOOKING_LIFECYCLE_TRANSITIONS.CANCELLED).toEqual([]);
    expect(BOOKING_LIFECYCLE_TRANSITIONS.NO_SHOW).toEqual([]);
  });

  it("requires ordered Stay and Occupancy execution", () => {
    expect(canTransition(STAY_LIFECYCLE_TRANSITIONS, "PREPARING", "ACTIVE")).toBe(true);
    expect(canTransition(STAY_LIFECYCLE_TRANSITIONS, "ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransition(STAY_LIFECYCLE_TRANSITIONS, "PREPARING", "COMPLETED")).toBe(false);
    expect(canTransition(OCCUPANCY_LIFECYCLE_TRANSITIONS, "ACTIVE", "ENDED")).toBe(true);
    expect(OCCUPANCY_LIFECYCLE_TRANSITIONS.ENDED).toEqual([]);
  });

  it("supports the same inspection lifecycle for entry and exit provenance", () => {
    expect(canTransition(INSPECTION_LIFECYCLE_TRANSITIONS, "DRAFT", "COMPLETED")).toBe(true);
    expect(INSPECTION_LIFECYCLE_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it("keeps long-term operational closure distinct from cancellation", () => {
    expect(canTransition(LEASE_OPERATIONAL_TRANSITIONS, "PREPARING", "OCCUPIED")).toBe(true);
    expect(canTransition(LEASE_OPERATIONAL_TRANSITIONS, "PREPARING", "CANCELLED")).toBe(true);
    expect(canTransition(LEASE_OPERATIONAL_TRANSITIONS, "OCCUPIED", "ENDED")).toBe(true);
    expect(canTransition(LEASE_OPERATIONAL_TRANSITIONS, "OCCUPIED", "CANCELLED")).toBe(false);
  });
});
