import { z } from "zod";

const UtcInstant = z.iso.datetime({ offset: false });
const Uuid = z.uuid();
export const RentalOperationPathSchema = z.object({ id: Uuid }).strict();
export const StartLeaseOccupancySchema = z.object({ occupancyId: Uuid, occurredAt: UtcInstant }).strict();
export const StartBookingStaySchema = z.object({ stayId: Uuid, occupancyId: Uuid, occurredAt: UtcInstant }).strict();
export const EndOccupancySchema = z.object({ occurredAt: UtcInstant, reason: z.enum(["SCHEDULED", "EARLY_DEPARTURE", "EARLY_TERMINATION", "OVERSTAY"]).optional() }).strict();
export const ExceptionalClosureSchema = z.object({ occurredAt: UtcInstant, reason: z.string().trim().min(1).max(500) }).strict();
export const BookingClosureSchema = ExceptionalClosureSchema.extend({ outcome: z.enum(["CANCELLED", "NO_SHOW"]) }).strict();
export const TemporalExtensionSchema = z.object({ newEndAt: UtcInstant, occurredAt: UtcInstant }).strict();
export const InspectionSchema = z.object({
  inspectionId: Uuid, idempotencyKey: Uuid,
  mode: z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]), type: z.enum(["ENTRY", "EXIT"]),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("LEASE"), id: Uuid }).strict(), z.object({ type: z.literal("BOOKING"), id: Uuid }).strict(),
    z.object({ type: z.literal("OCCUPANCY"), id: Uuid }).strict(),
  ]), occurredAt: UtcInstant,
  conditionRecords: z.array(z.object({ area: z.string().trim().min(1).max(120), item: z.string().trim().min(1).max(160), assessment: z.enum(["GOOD", "FAIR", "POOR", "DAMAGED", "MISSING"]), observation: z.string().trim().min(1).max(2000).optional(), damageObserved: z.boolean() }).strict()).max(500),
  evidenceReferences: z.array(z.object({ type: z.enum(["PHOTO", "SIGNATURE", "DOCUMENT"]), referenceId: z.string().trim().min(1).max(250) }).strict()).max(100),
}).strict();
export const CheckoutSchema = z.object({ rentableAssetId: Uuid, operationalBlockId: Uuid, allocationId: Uuid, checkedOutAt: UtcInstant, expectedCleaningCompletionAt: UtcInstant }).strict();
export const CompleteCleaningSchema = z.object({ completedAt: UtcInstant }).strict();
const Capabilities = z.object({ canCompleteEntryInspection: z.boolean(), canStartOccupancy: z.boolean(), canCompleteExitInspection: z.boolean(), canEndOccupancy: z.boolean(),
  canCancel: z.boolean(), canRecordNoShow: z.boolean(), canExtend: z.boolean(), canRenew: z.boolean() }).strict();
const OperationalBlockSummarySchema = z.object({ operationalBlockId: Uuid, reason: z.string(), startAt: UtcInstant, endAt: UtcInstant, status: z.enum(["ACTIVE", "RELEASED"]) }).strict();
const InspectionSummarySchema = z.object({ inspectionId: Uuid, type: z.enum(["ENTRY", "EXIT"]), occurredAt: UtcInstant, damageObserved: z.boolean() }).strict();
const RecentOperationSummarySchema = z.object({ eventType: z.string(), occurredAt: UtcInstant }).strict();
export const LifecycleSnapshotSchema = z.object({
  tenantId: Uuid, rentableAssetId: Uuid, mode: z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]), leaseId: Uuid.optional(),
  leaseStatus: z.enum(["PREPARING", "OCCUPIED", "ENDED", "CANCELLED"]).optional(), bookingId: Uuid.optional(),
  bookingStatus: z.enum(["CONFIRMED", "IN_STAY", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(), plannedArrivalAt: UtcInstant.optional(),
  plannedDepartureAt: UtcInstant.optional(), stayId: Uuid.optional(), actualCheckInAt: UtcInstant.optional(), actualCheckOutAt: UtcInstant.optional(),
  occupancyId: Uuid.optional(), actualOccupancyStartedAt: UtcInstant.optional(), actualOccupancyEndedAt: UtcInstant.optional(), nextAvailableAt: UtcInstant.optional(),
  activeBlocks: z.array(OperationalBlockSummarySchema).optional(), inspections: z.array(InspectionSummarySchema).optional(), recentOperations: z.array(RecentOperationSummarySchema).optional(), capabilities: Capabilities.optional(),
}).strict();
export const LifecycleListSchema = z.object({ items: z.array(LifecycleSnapshotSchema) }).strict();
export const InspectionResponseSchema = InspectionSchema.omit({ idempotencyKey: true }).extend({ tenantId: Uuid, rentableAssetId: Uuid, responsibleActorId: z.string(), status: z.literal("COMPLETED") }).strict();
export const TurnoverResponseSchema = z.object({ occupancyId: Uuid, stayId: Uuid, bookingId: Uuid, rentableAssetId: Uuid, checkedOutAt: UtcInstant,
  cleaningBlockId: Uuid, cleaningStartsAt: UtcInstant, cleaningEndsAt: UtcInstant, cleaningStatus: z.enum(["ACTIVE", "RELEASED"]),
  cleaningCompletedAt: UtcInstant.optional(), cleaningCompletedByActorId: z.string().optional() }).strict();
