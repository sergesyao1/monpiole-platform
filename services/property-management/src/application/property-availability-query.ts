import type {
  PropertyAvailabilityStatus,
  PropertyOccupancyStatus,
} from "../domain/property.js";

export type DirectPropertyAvailability =
  | Readonly<{
    propertyId: string;
    source: "DIRECT";
    structuralRole: "STANDALONE" | "UNIT" | "COMPOSITE";
    configured: false;
  }>
  | Readonly<{
    propertyId: string;
    source: "DIRECT";
    structuralRole: "STANDALONE" | "UNIT" | "COMPOSITE";
    configured: true;
    availabilityStatus: PropertyAvailabilityStatus;
    occupancyStatus: PropertyOccupancyStatus;
    updatedAt: string;
  }>;

export interface CompositePropertyAvailability {
  readonly propertyId: string;
  readonly source: "DERIVED_FROM_UNITS";
  readonly structuralRole: "COMPOSITE";
  readonly availabilityStatus: PropertyAvailabilityStatus | "NOT_CONFIGURED";
  readonly totalUnitCount: number;
  readonly configuredUnitCount: number;
  readonly availableUnitCount: number;
  readonly unavailableUnitCount: number;
  readonly vacantUnitCount: number;
  readonly occupiedUnitCount: number;
  readonly unconfiguredUnitCount: number;
}

export type PropertyAvailabilityReadModel = DirectPropertyAvailability | CompositePropertyAvailability;

export interface PropertyAvailabilityQuery {
  retrieve(tenantId: string, propertyId: string): Promise<PropertyAvailabilityReadModel | undefined>;
}
