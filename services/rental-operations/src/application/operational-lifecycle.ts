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
}

export interface OperationalLifecycleRepository {
  startLeaseOccupancy(input: Readonly<{ tenantId: string; leaseId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot>;
  startBookingStay(input: Readonly<{ tenantId: string; bookingId: string; stayId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot>;
  endOccupancy(input: Readonly<{ tenantId: string; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot>;
}

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

  execute(command: Readonly<{ authority: RentalOperationsAuthority; occupancyId: string; occurredAt: string }>): Promise<OperationalLifecycleSnapshot> {
    return this.repository.endOccupancy({ ...command, tenantId: this.tenant(command.authority) });
  }
}
