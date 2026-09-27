import type { BookingLifecycleStatus, LeaseOperationalStatus } from "../domain/operational-lifecycle-specification.js";
import type { RentalOperationMode } from "../domain/rental-operations.js";

export type RentalOperationsGrant = "MANAGE_RENTAL_OPERATIONS" | "RETRIEVE_RENTAL_OPERATIONS";

export interface RentalOperationsAuthority {
  readonly actorId: string;
  readonly grants: readonly RentalOperationsGrant[];
  readonly tenantIds: readonly string[];
}

export interface OperationalLifecycleSnapshot {
  readonly tenantId: string;
  readonly rentableAssetId: string;
  readonly mode: RentalOperationMode;
  readonly leaseId?: string;
  readonly leaseStatus?: LeaseOperationalStatus;
  readonly bookingId?: string;
  readonly bookingStatus?: BookingLifecycleStatus;
  readonly plannedArrivalAt?: string;
  readonly plannedDepartureAt?: string;
  readonly stayId?: string;
  readonly actualCheckInAt?: string;
  readonly actualCheckOutAt?: string;
  readonly occupancyId?: string;
  readonly actualOccupancyStartedAt?: string;
  readonly actualOccupancyEndedAt?: string;
  readonly nextAvailableAt?: string;
  readonly activeBlocks?: readonly OperationalBlockSummary[];
  readonly recentOperations?: readonly RecentOperationSummary[];
  readonly inspections?: readonly InspectionSummary[];
  readonly capabilities?: Readonly<{
    canCompleteEntryInspection: boolean;
    canStartOccupancy: boolean;
    canCompleteExitInspection: boolean;
    canEndOccupancy: boolean;
    canCancel: boolean;
    canRecordNoShow: boolean;
    canExtend: boolean;
    canRenew: boolean;
  }>;
}

export interface OperationalBlockSummary { readonly operationalBlockId: string; readonly reason: string; readonly startAt: string; readonly endAt: string; readonly status: "ACTIVE" | "RELEASED"; }
export interface InspectionSummary { readonly inspectionId: string; readonly type: "ENTRY" | "EXIT"; readonly occurredAt: string; readonly damageObserved: boolean; }
export interface RecentOperationSummary { readonly eventType: string; readonly occurredAt: string; }

export interface OperationalLifecycleRepository {
  list(tenantId: string): Promise<readonly OperationalLifecycleSnapshot[]>;
  startLeaseOccupancy(input: Readonly<{ tenantId: string; leaseId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot>;
  startBookingStay(input: Readonly<{ tenantId: string; bookingId: string; stayId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot>;
  endOccupancy(input: Readonly<{ tenantId: string; occupancyId: string; occurredAt: string; reason?: OccupancyEndReason }>): Promise<OperationalLifecycleSnapshot>;
  cancelLease(input: ExceptionalSourceCommand & Readonly<{ leaseId: string }>): Promise<OperationalLifecycleSnapshot>;
  cancelBooking(input: ExceptionalSourceCommand & Readonly<{ bookingId: string; outcome: "CANCELLED" | "NO_SHOW" }>): Promise<OperationalLifecycleSnapshot>;
  extendBooking(input: TemporalExtensionCommand & Readonly<{ bookingId: string }>): Promise<OperationalLifecycleSnapshot>;
  renewLease(input: TemporalExtensionCommand & Readonly<{ leaseId: string }>): Promise<OperationalLifecycleSnapshot>;
}

export type OccupancyEndReason = "SCHEDULED" | "EARLY_DEPARTURE" | "EARLY_TERMINATION" | "OVERSTAY";
interface ExceptionalSourceCommand { readonly tenantId: string; readonly occurredAt: string; readonly reason: string; }
interface TemporalExtensionCommand { readonly tenantId: string; readonly newEndAt: string; readonly occurredAt: string; }

export class RentalOperationsForbiddenError extends Error { readonly code = "RENTAL_OPERATIONS_FORBIDDEN"; }
export class OperationalSourceNotFoundError extends Error { readonly code = "OPERATIONAL_SOURCE_NOT_FOUND"; }
export class OperationalLifecycleConflictError extends Error { readonly code = "OPERATIONAL_LIFECYCLE_CONFLICT"; }

abstract class AuthorizedLifecycleUseCase {
  protected tenant(authority: RentalOperationsAuthority): string {
    if (!authority.grants.includes("MANAGE_RENTAL_OPERATIONS") || authority.tenantIds.length !== 1) {
      throw new RentalOperationsForbiddenError();
    }
    return authority.tenantIds[0]!;
  }
}

export class StartLeaseOccupancy extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }

  execute(command: Readonly<{ authority: RentalOperationsAuthority; leaseId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return this.repository.startLeaseOccupancy({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class StartBookingStay extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }

  execute(command: Readonly<{ authority: RentalOperationsAuthority; bookingId: string; stayId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return this.repository.startBookingStay({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class EndRentalOccupancy extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }

  execute(command: Readonly<{ authority: RentalOperationsAuthority; occupancyId: string; occurredAt: string; reason?: OccupancyEndReason }>): Promise<OperationalLifecycleSnapshot> {
    return this.repository.endOccupancy({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class CancelRentalLease extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }
  execute(command: Readonly<{ authority: RentalOperationsAuthority; leaseId: string; occurredAt: string; reason: string }>) {
    return this.repository.cancelLease({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class CloseRentalBooking extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }
  execute(command: Readonly<{ authority: RentalOperationsAuthority; bookingId: string; occurredAt: string; reason: string; outcome: "CANCELLED" | "NO_SHOW" }>) {
    return this.repository.cancelBooking({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class ExtendRentalBooking extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }
  execute(command: Readonly<{ authority: RentalOperationsAuthority; bookingId: string; newEndAt: string; occurredAt: string }>) {
    return this.repository.extendBooking({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class RenewRentalLease extends AuthorizedLifecycleUseCase {
  constructor(private readonly repository: OperationalLifecycleRepository) { super(); }
  execute(command: Readonly<{ authority: RentalOperationsAuthority; leaseId: string; newEndAt: string; occurredAt: string }>) {
    return this.repository.renewLease({ ...command, tenantId: this.tenant(command.authority) });
  }
}

export class ListRentalOperations {
  constructor(private readonly repository: OperationalLifecycleRepository) {}

  execute(query: Readonly<{ authority: RentalOperationsAuthority }>): Promise<readonly OperationalLifecycleSnapshot[]> {
    if (!query.authority.grants.includes("RETRIEVE_RENTAL_OPERATIONS") || query.authority.tenantIds.length !== 1) {
      throw new RentalOperationsForbiddenError();
    }
    return this.repository.list(query.authority.tenantIds[0]!);
  }
}
