import type { AccessTokenProvider } from "../../infrastructure/http/api-client.js";
import { createAuthenticatedApiClient } from "../../infrastructure/http/api-client.js";

export interface RentalOperationCapabilities { readonly canCompleteEntryInspection: boolean; readonly canStartOccupancy: boolean; readonly canCompleteExitInspection: boolean; readonly canEndOccupancy: boolean }
export interface RentalOperationItem {
  readonly tenantId: string; readonly rentableAssetId: string; readonly mode: "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL";
  readonly leaseId?: string; readonly leaseStatus?: "PREPARING" | "OCCUPIED" | "ENDED" | "CANCELLED";
  readonly bookingId?: string; readonly bookingStatus?: "CONFIRMED" | "IN_STAY" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  readonly plannedArrivalAt?: string; readonly plannedDepartureAt?: string; readonly stayId?: string;
  readonly actualCheckInAt?: string; readonly actualCheckOutAt?: string; readonly occupancyId?: string;
  readonly actualOccupancyStartedAt?: string; readonly actualOccupancyEndedAt?: string; readonly capabilities?: RentalOperationCapabilities;
}
export interface InspectionDraft { readonly area: string; readonly item: string; readonly assessment: "GOOD" | "FAIR" | "POOR" | "DAMAGED" | "MISSING"; readonly observation?: string; readonly damageObserved: boolean }

export function createRentalOperationsApi(tokens: AccessTokenProvider) {
  const request = createAuthenticatedApiClient(tokens);
  return {
    list: () => request<{ readonly items: readonly RentalOperationItem[] }>("/v1/rental-operations"),
    completeInspection: (item: RentalOperationItem, type: "ENTRY" | "EXIT", draft: InspectionDraft) => request("/v1/rental-operations/inspections", { method: "POST", body: {
      inspectionId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), mode: item.mode, type,
      source: type === "EXIT" ? { type: "OCCUPANCY", id: item.occupancyId } : item.mode === "LONG_TERM_RENTAL" ? { type: "LEASE", id: item.leaseId } : { type: "BOOKING", id: item.bookingId },
      occurredAt: new Date().toISOString(), conditionRecords: [draft], evidenceReferences: [],
    } }),
    start: (item: RentalOperationItem) => item.mode === "LONG_TERM_RENTAL"
      ? request(`/v1/rental-operations/leases/${encodeURIComponent(item.leaseId!)}/occupancies`, { method: "POST", body: { occupancyId: crypto.randomUUID(), occurredAt: new Date().toISOString() } })
      : request(`/v1/rental-operations/bookings/${encodeURIComponent(item.bookingId!)}/stays`, { method: "POST", body: { stayId: crypto.randomUUID(), occupancyId: crypto.randomUUID(), occurredAt: new Date().toISOString() } }),
    endLongTerm: (item: RentalOperationItem) => request(`/v1/rental-operations/occupancies/${encodeURIComponent(item.occupancyId!)}/end`, { method: "POST", body: { occurredAt: new Date().toISOString() } }),
    checkout: (item: RentalOperationItem, expectedCleaningCompletionAt: string) => request(`/v1/rental-operations/occupancies/${encodeURIComponent(item.occupancyId!)}/checkout`, { method: "POST", body: {
      rentableAssetId: item.rentableAssetId, operationalBlockId: crypto.randomUUID(), allocationId: crypto.randomUUID(),
      checkedOutAt: new Date().toISOString(), expectedCleaningCompletionAt,
    } }),
  };
}
