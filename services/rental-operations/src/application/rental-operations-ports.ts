import type { RentalOperationMode } from "../domain/rental-operations.js";

export interface RentableTargetReference {
  readonly rentableAssetId: string;
  readonly mode: RentalOperationMode;
}

export interface RentableTargetResolver {
  resolve(tenantId: string, rentableAssetId: string): Promise<RentableTargetReference | undefined>;
}

export interface ActivePropertyContractReference {
  readonly propertyContractId: string;
  readonly rentableAssetId: string;
  readonly contractType: "LEASE";
  readonly status: "ACTIVE";
}

export interface ActivePropertyContractResolver {
  resolve(tenantId: string, propertyContractId: string): Promise<ActivePropertyContractReference | undefined>;
}

export const RENTAL_OPERATIONS_EVENT_TYPES = [
  "monpiole.rental-operations.lease-operationalized",
  "monpiole.rental-operations.booking-confirmed",
  "monpiole.rental-operations.stay-started",
  "monpiole.rental-operations.stay-completed",
  "monpiole.rental-operations.occupancy-started",
  "monpiole.rental-operations.occupancy-ended",
  "monpiole.rental-operations.entry-inspection-completed",
  "monpiole.rental-operations.exit-inspection-completed",
  "monpiole.rental-operations.allocation-created",
  "monpiole.rental-operations.allocation-released",
  "monpiole.rental-operations.operational-block-created",
  "monpiole.rental-operations.operational-block-released",
] as const;

export type RentalOperationsEventType = typeof RENTAL_OPERATIONS_EVENT_TYPES[number];
