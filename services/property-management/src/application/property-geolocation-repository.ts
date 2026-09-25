import type { PropertyGeolocation } from "../domain/property-geolocation.js";

export type PropertyGeolocationResolution =
  | Readonly<{ source: "OWN"; geolocation?: PropertyGeolocation }>
  | Readonly<{ source: "INHERITED"; inheritedFromPropertyId: string; geolocation?: PropertyGeolocation }>;

export interface PropertyGeolocationMutationTrace {
  readonly updatedAt: string;
  readonly correlationId: string;
  readonly actorId: string;
}

export interface PropertyGeolocationRepository {
  findEffective(tenantId: string, propertyId: string): Promise<PropertyGeolocationResolution | undefined>;
  saveOwn(
    tenantId: string,
    propertyId: string,
    geolocation: PropertyGeolocation,
    trace: PropertyGeolocationMutationTrace,
  ): Promise<PropertyGeolocation | undefined>;
  removeOwn(tenantId: string, propertyId: string): Promise<boolean | undefined>;
}

export class PropertyUnitGeolocationInheritedError extends Error {
  readonly code = "PROPERTY_UNIT_GEOLOCATION_INHERITED";
}
