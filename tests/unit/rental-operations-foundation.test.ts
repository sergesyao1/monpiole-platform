import { describe, expect, it } from "vitest";

import {
  Booking,
  InvalidRentalOperationsInputError,
  Lease,
  Occupancy,
  OperationalBlock,
  PropertyInspection,
  RentalAllocation,
  Stay,
  type LeaseValues,
} from "../../services/rental-operations/src/index.js";

const ids = {
  tenant: "11111111-1111-4111-8111-111111111111",
  asset: "22222222-2222-4222-8222-222222222222",
  contract: "33333333-3333-4333-8333-333333333333",
  lease: "44444444-4444-4444-8444-444444444444",
  booking: "55555555-5555-4555-8555-555555555555",
  stay: "66666666-6666-4666-8666-666666666666",
  occupancy: "77777777-7777-4777-8777-777777777777",
  inspection: "88888888-8888-4888-8888-888888888888",
  allocation: "99999999-9999-4999-8999-999999999999",
  block: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;
const createdAt = "2026-09-27T10:00:00.000Z";

function lease() {
  return Lease.create({
    leaseId: ids.lease,
    tenantId: ids.tenant,
    rentableAssetId: ids.asset,
    sourcePropertyContractId: ids.contract,
    mode: "LONG_TERM_RENTAL",
    createdAt,
  });
}

function booking() {
  return Booking.create({
    bookingId: ids.booking,
    tenantId: ids.tenant,
    rentableAssetId: ids.asset,
    mode: "SHORT_TERM_RENTAL",
    arrivalAt: "2026-10-01T14:00:00.000Z",
    departureAt: "2026-10-05T10:00:00.000Z",
    createdAt,
  });
}

describe("Rental Operations domain foundation", () => {
  it("accepts LONG_TERM_RENTAL as an explicit Lease mode", () => {
    expect(lease().values.mode).toBe("LONG_TERM_RENTAL");
  });

  it("accepts SHORT_TERM_RENTAL as an explicit Booking mode", () => {
    expect(booking().values.mode).toBe("SHORT_TERM_RENTAL");
  });

  it("rejects an invalid operational mode", () => {
    const invalid = { ...lease().values, mode: "SALE" } as unknown as LeaseValues;
    expect(() => Lease.create(invalid)).toThrow(InvalidRentalOperationsInputError);
  });

  it("keeps Lease and Booking distinct with different provenance and time semantics", () => {
    expect(lease()).toBeInstanceOf(Lease);
    expect(booking()).toBeInstanceOf(Booking);
    expect(lease().values).toHaveProperty("sourcePropertyContractId");
    expect(booking().values).toHaveProperty("arrivalAt");
  });

  it("requires a Stay to reference a Booking", () => {
    const stay = Stay.create({
      stayId: ids.stay,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      bookingId: ids.booking,
      mode: "SHORT_TERM_RENTAL",
      createdAt,
    });
    expect(stay.values.bookingId).toBe(ids.booking);
  });

  it.each([
    ["LONG_TERM_RENTAL", "ENTRY"],
    ["LONG_TERM_RENTAL", "EXIT"],
    ["SHORT_TERM_RENTAL", "ENTRY"],
    ["SHORT_TERM_RENTAL", "EXIT"],
  ] as const)("supports %s %s inspections", (mode, type) => {
    const inspection = PropertyInspection.create({
      inspectionId: ids.inspection,
      tenantId: ids.tenant,
      occupancyId: ids.occupancy,
      mode,
      type,
      occurredAt: "2026-10-01T14:05:00.000Z",
      createdAt,
    });
    expect(inspection.values).toMatchObject({ mode, type });
  });

  it("represents persisted long-term operational occupancy from a Lease", () => {
    const occupancy = Occupancy.create({
      occupancyId: ids.occupancy,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      mode: "LONG_TERM_RENTAL",
      sourceLeaseId: ids.lease,
      startedAt: "2026-10-01T08:00:00.000Z",
      createdAt,
    });
    expect(occupancy.values.sourceLeaseId).toBe(ids.lease);
  });

  it("represents short-term occupancy from a Stay rather than directly from Booking", () => {
    const occupancy = Occupancy.create({
      occupancyId: ids.occupancy,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      mode: "SHORT_TERM_RENTAL",
      sourceStayId: ids.stay,
      startedAt: "2026-10-01T14:00:00.000Z",
      endedAt: "2026-10-05T10:00:00.000Z",
      createdAt,
    });
    expect(occupancy.values.sourceStayId).toBe(ids.stay);
  });

  it("allows open-ended Lease allocations", () => {
    const allocation = RentalAllocation.create({
      allocationId: ids.allocation,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      allocationType: "LEASE",
      sourceLeaseId: ids.lease,
      startAt: "2026-10-01T00:00:00.000Z",
      createdAt,
    });
    expect(allocation.values.endAt).toBeUndefined();
  });

  it("rejects invalid bounded allocation intervals", () => {
    expect(() => RentalAllocation.create({
      allocationId: ids.allocation,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      allocationType: "BOOKING",
      sourceBookingId: ids.booking,
      startAt: "2026-10-05T10:00:00.000Z",
      endAt: "2026-10-01T14:00:00.000Z",
      createdAt,
    })).toThrow(InvalidRentalOperationsInputError);
  });

  it("models operational blocks independently from rental commitments", () => {
    const block = OperationalBlock.create({
      operationalBlockId: ids.block,
      tenantId: ids.tenant,
      rentableAssetId: ids.asset,
      reason: "MAINTENANCE",
      startAt: "2026-10-06T08:00:00.000Z",
      endAt: "2026-10-07T18:00:00.000Z",
      createdAt,
    });
    expect(block.values.reason).toBe("MAINTENANCE");
  });
});
