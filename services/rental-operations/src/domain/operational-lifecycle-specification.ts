export const BOOKING_LIFECYCLE_STATUSES = [
  "CONFIRMED",
  "IN_STAY",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type BookingLifecycleStatus = typeof BOOKING_LIFECYCLE_STATUSES[number];

export const STAY_LIFECYCLE_STATUSES = ["PREPARING", "ACTIVE", "COMPLETED"] as const;
export type StayLifecycleStatus = typeof STAY_LIFECYCLE_STATUSES[number];

export const OCCUPANCY_LIFECYCLE_STATUSES = ["ACTIVE", "ENDED"] as const;
export type OccupancyLifecycleStatus = typeof OCCUPANCY_LIFECYCLE_STATUSES[number];

export const INSPECTION_LIFECYCLE_STATUSES = ["DRAFT", "COMPLETED"] as const;
export type InspectionLifecycleStatus = typeof INSPECTION_LIFECYCLE_STATUSES[number];

export const LEASE_OPERATIONAL_STATUSES = ["PREPARING", "OCCUPIED", "ENDED", "CANCELLED"] as const;
export type LeaseOperationalStatus = typeof LEASE_OPERATIONAL_STATUSES[number];

export const BOOKING_LIFECYCLE_TRANSITIONS = {
  CONFIRMED: ["IN_STAY", "CANCELLED", "NO_SHOW"],
  IN_STAY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
} as const satisfies Record<BookingLifecycleStatus, readonly BookingLifecycleStatus[]>;

export const STAY_LIFECYCLE_TRANSITIONS = {
  PREPARING: ["ACTIVE"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: [],
} as const satisfies Record<StayLifecycleStatus, readonly StayLifecycleStatus[]>;

export const OCCUPANCY_LIFECYCLE_TRANSITIONS = {
  ACTIVE: ["ENDED"],
  ENDED: [],
} as const satisfies Record<OccupancyLifecycleStatus, readonly OccupancyLifecycleStatus[]>;

export const INSPECTION_LIFECYCLE_TRANSITIONS = {
  DRAFT: ["COMPLETED"],
  COMPLETED: [],
} as const satisfies Record<InspectionLifecycleStatus, readonly InspectionLifecycleStatus[]>;

export const LEASE_OPERATIONAL_TRANSITIONS = {
  PREPARING: ["OCCUPIED", "CANCELLED"],
  OCCUPIED: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
} as const satisfies Record<LeaseOperationalStatus, readonly LeaseOperationalStatus[]>;

export type OperationalLifecycleEventType =
  | "monpiole.rental-operations.lease-operationalized"
  | "monpiole.rental-operations.booking-confirmed"
  | "monpiole.rental-operations.stay-started"
  | "monpiole.rental-operations.stay-completed"
  | "monpiole.rental-operations.occupancy-started"
  | "monpiole.rental-operations.occupancy-ended"
  | "monpiole.rental-operations.entry-inspection-completed"
  | "monpiole.rental-operations.exit-inspection-completed"
  | "monpiole.rental-operations.allocation-created"
  | "monpiole.rental-operations.allocation-released"
  | "monpiole.rental-operations.operational-block-created"
  | "monpiole.rental-operations.operational-block-released";

export function canTransition<TStatus extends string>(
  transitions: Readonly<Record<TStatus, readonly TStatus[]>>,
  from: TStatus,
  to: TStatus,
): boolean {
  return transitions[from].includes(to);
}
