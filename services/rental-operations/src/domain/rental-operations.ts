const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const RENTAL_OPERATION_MODES = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"] as const;
export type RentalOperationMode = typeof RENTAL_OPERATION_MODES[number];
export const INSPECTION_TYPES = ["ENTRY", "EXIT"] as const;
export type PropertyInspectionType = typeof INSPECTION_TYPES[number];
export const ALLOCATION_TYPES = ["LEASE", "BOOKING", "OPERATIONAL_BLOCK"] as const;
export type RentalAllocationType = typeof ALLOCATION_TYPES[number];
export const TEMPORAL_RECORD_STATUSES = ["ACTIVE", "RELEASED"] as const;
export type TemporalRecordStatus = typeof TEMPORAL_RECORD_STATUSES[number];
export const OPERATIONAL_BLOCK_REASONS = [
  "MAINTENANCE", "OWNER_USE", "CLEANING", "PREPARATION", "INSPECTION", "RENOVATION", "ADMINISTRATIVE_BLOCK", "OTHER",
] as const;
export type OperationalBlockReason = typeof OPERATIONAL_BLOCK_REASONS[number];

export class InvalidRentalOperationsInputError extends Error {
  readonly code = "INVALID_RENTAL_OPERATIONS_INPUT";

  constructor(readonly field: string) {
    super(`Invalid Rental Operations ${field}`);
    this.name = "InvalidRentalOperationsInputError";
  }
}

interface TenantRecord {
  readonly tenantId: string;
  readonly createdAt: string;
}

interface RentableTargetRecord extends TenantRecord {
  readonly rentableAssetId: string;
}

export interface LeaseValues extends RentableTargetRecord {
  readonly leaseId: string;
  readonly sourcePropertyContractId: string;
  readonly mode: "LONG_TERM_RENTAL";
}

export class Lease {
  private constructor(readonly values: Readonly<LeaseValues>) {}

  static create(input: LeaseValues): Lease {
    validateRecord(input);
    uuid(input.leaseId, "leaseId");
    uuid(input.sourcePropertyContractId, "sourcePropertyContractId");
    if (input.mode !== "LONG_TERM_RENTAL") invalid("mode");
    return new Lease(Object.freeze({ ...input }));
  }
}

export interface BookingValues extends RentableTargetRecord {
  readonly bookingId: string;
  readonly mode: "SHORT_TERM_RENTAL";
  readonly arrivalAt: string;
  readonly departureAt: string;
}

export class Booking {
  private constructor(readonly values: Readonly<BookingValues>) {}

  static create(input: BookingValues): Booking {
    validateRecord(input);
    uuid(input.bookingId, "bookingId");
    if (input.mode !== "SHORT_TERM_RENTAL") invalid("mode");
    boundedInterval(input.arrivalAt, input.departureAt);
    return new Booking(Object.freeze({ ...input }));
  }
}

export interface StayValues extends RentableTargetRecord {
  readonly stayId: string;
  readonly bookingId: string;
  readonly mode: "SHORT_TERM_RENTAL";
}

export class Stay {
  private constructor(readonly values: Readonly<StayValues>) {}

  static create(input: StayValues): Stay {
    validateRecord(input);
    uuid(input.stayId, "stayId");
    uuid(input.bookingId, "bookingId");
    if (input.mode !== "SHORT_TERM_RENTAL") invalid("mode");
    return new Stay(Object.freeze({ ...input }));
  }
}

export type OccupancyValues = RentableTargetRecord & Readonly<{
  occupancyId: string;
  mode: RentalOperationMode;
  startedAt: string;
  endedAt?: string;
}> & (
  | Readonly<{ mode: "LONG_TERM_RENTAL"; sourceLeaseId: string; sourceStayId?: never }>
  | Readonly<{ mode: "SHORT_TERM_RENTAL"; sourceStayId: string; sourceLeaseId?: never }>
);

export class Occupancy {
  private constructor(readonly values: Readonly<OccupancyValues>) {}

  static create(input: OccupancyValues): Occupancy {
    validateRecord(input);
    uuid(input.occupancyId, "occupancyId");
    instant(input.startedAt, "startedAt");
    if (input.endedAt !== undefined) boundedInterval(input.startedAt, input.endedAt);
    if (input.mode === "LONG_TERM_RENTAL") uuid(input.sourceLeaseId, "sourceLeaseId");
    else if (input.mode === "SHORT_TERM_RENTAL") uuid(input.sourceStayId, "sourceStayId");
    else invalid("mode");
    return new Occupancy(Object.freeze({ ...input }));
  }
}

export interface PropertyInspectionValues extends TenantRecord {
  readonly inspectionId: string;
  readonly occupancyId: string;
  readonly mode: RentalOperationMode;
  readonly type: PropertyInspectionType;
  readonly occurredAt: string;
}

export class PropertyInspection {
  private constructor(readonly values: Readonly<PropertyInspectionValues>) {}

  static create(input: PropertyInspectionValues): PropertyInspection {
    validateTenantRecord(input);
    uuid(input.inspectionId, "inspectionId");
    uuid(input.occupancyId, "occupancyId");
    mode(input.mode);
    if (!INSPECTION_TYPES.includes(input.type)) invalid("type");
    instant(input.occurredAt, "occurredAt");
    return new PropertyInspection(Object.freeze({ ...input }));
  }
}

export interface OperationalBlockValues extends RentableTargetRecord {
  readonly operationalBlockId: string;
  readonly reason: OperationalBlockReason;
  readonly startAt: string;
  readonly endAt: string;
  readonly status: TemporalRecordStatus;
  readonly note?: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly updatedAt: string;
}

export class OperationalBlock {
  private constructor(readonly values: Readonly<OperationalBlockValues>) {}

  static create(input: OperationalBlockValues): OperationalBlock {
    validateRecord(input);
    uuid(input.operationalBlockId, "operationalBlockId");
    if (!OPERATIONAL_BLOCK_REASONS.includes(input.reason)) invalid("reason");
    boundedInterval(input.startAt, input.endAt);
    temporalStatus(input.status);
    instant(input.updatedAt, "updatedAt");
    if (Date.parse(input.updatedAt) < Date.parse(input.createdAt)) invalid("updatedAt");
    if ((input.sourceType === undefined) !== (input.sourceId === undefined)) invalid("source");
    if (input.note !== undefined && (input.note.trim().length === 0 || input.note.length > 2_000)) invalid("note");
    return new OperationalBlock(Object.freeze({ ...input }));
  }
}

interface AllocationBase extends RentableTargetRecord {
  readonly allocationId: string;
  readonly startAt: string;
  readonly endAt?: string;
  readonly status: TemporalRecordStatus;
  readonly updatedAt: string;
}

export type RentalAllocationValues =
  | (AllocationBase & Readonly<{
      allocationType: "LEASE";
      rentalMode: "LONG_TERM_RENTAL";
      sourceLeaseId: string;
      sourceBookingId?: never;
      sourceOperationalBlockId?: never;
    }>)
  | (AllocationBase & Readonly<{
      allocationType: "BOOKING";
      rentalMode: "SHORT_TERM_RENTAL";
      sourceBookingId: string;
      sourceLeaseId?: never;
      sourceOperationalBlockId?: never;
      endAt: string;
    }>)
  | (AllocationBase & Readonly<{
      allocationType: "OPERATIONAL_BLOCK";
      rentalMode?: RentalOperationMode;
      sourceOperationalBlockId: string;
      sourceLeaseId?: never;
      sourceBookingId?: never;
      endAt: string;
    }>);

export class RentalAllocation {
  private constructor(readonly values: Readonly<RentalAllocationValues>) {}

  static create(input: RentalAllocationValues): RentalAllocation {
    validateRecord(input);
    uuid(input.allocationId, "allocationId");
    instant(input.startAt, "startAt");
    temporalStatus(input.status);
    instant(input.updatedAt, "updatedAt");
    if (Date.parse(input.updatedAt) < Date.parse(input.createdAt)) invalid("updatedAt");
    if (input.allocationType === "LEASE") {
      if (input.rentalMode !== "LONG_TERM_RENTAL") invalid("rentalMode");
      uuid(input.sourceLeaseId, "sourceLeaseId");
      if (input.endAt !== undefined) boundedInterval(input.startAt, input.endAt);
    } else if (input.allocationType === "BOOKING") {
      if (input.rentalMode !== "SHORT_TERM_RENTAL") invalid("rentalMode");
      uuid(input.sourceBookingId, "sourceBookingId");
      boundedInterval(input.startAt, input.endAt);
    } else if (input.allocationType === "OPERATIONAL_BLOCK") {
      if (input.rentalMode !== undefined) mode(input.rentalMode);
      uuid(input.sourceOperationalBlockId, "sourceOperationalBlockId");
      boundedInterval(input.startAt, input.endAt);
    } else {
      invalid("allocationType");
    }
    return new RentalAllocation(Object.freeze({ ...input }));
  }
}

function temporalStatus(value: string): asserts value is TemporalRecordStatus {
  if (!TEMPORAL_RECORD_STATUSES.includes(value as TemporalRecordStatus)) invalid("status");
}

function validateRecord(input: RentableTargetRecord): void {
  validateTenantRecord(input);
  uuid(input.rentableAssetId, "rentableAssetId");
}

function validateTenantRecord(input: TenantRecord): void {
  uuid(input.tenantId, "tenantId");
  instant(input.createdAt, "createdAt");
}

function mode(value: string): asserts value is RentalOperationMode {
  if (!RENTAL_OPERATION_MODES.includes(value as RentalOperationMode)) invalid("mode");
}

function uuid(value: string, field: string): void {
  if (!UUID_V4.test(value)) invalid(field);
}

function instant(value: string, field: string): void {
  if (!value.endsWith("Z") || !Number.isFinite(Date.parse(value))) invalid(field);
}

function boundedInterval(startAt: string, endAt: string): void {
  instant(startAt, "startAt");
  instant(endAt, "endAt");
  if (Date.parse(endAt) <= Date.parse(startAt)) invalid("endAt");
}

function invalid(field: string): never {
  throw new InvalidRentalOperationsInputError(field);
}
