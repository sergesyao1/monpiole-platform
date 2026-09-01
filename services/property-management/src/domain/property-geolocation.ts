const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CANONICAL_DECIMALS = 6;
const APPROXIMATE_DECIMALS = 2;

export const PROPERTY_GEOLOCATION_PUBLIC_VISIBILITIES = ["EXACT", "APPROXIMATE", "HIDDEN"] as const;
export type PropertyGeolocationPublicVisibility = typeof PROPERTY_GEOLOCATION_PUBLIC_VISIBILITIES[number];

export interface PropertyGeolocationValues {
  readonly propertyId: string;
  readonly tenantId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly publicVisibility: PropertyGeolocationPublicVisibility;
}

export interface PropertyPublicPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: "EXACT" | "APPROXIMATE";
}

type PropertyGeolocationField = keyof PropertyGeolocationValues;

class PropertyGeolocationInvariantViolation extends Error {
  constructor(readonly field: PropertyGeolocationField) {
    super(`Invalid property geolocation ${field}`);
  }
}

export class InvalidPropertyGeolocationInputError extends Error {
  readonly code = "INVALID_PROPERTY_GEOLOCATION_INPUT";
  constructor(readonly field: "latitude" | "longitude" | "publicVisibility") {
    super(`Invalid property geolocation ${field}`);
  }
}

export class InvalidPropertyGeolocationServerValueError extends Error {
  constructor(readonly field: "propertyId" | "tenantId") {
    super(`Invalid server property geolocation ${field}`);
  }
}

export class PersistedPropertyGeolocationCorruptionError extends Error {
  constructor(readonly field: PropertyGeolocationField) {
    super(`Invalid persisted property geolocation ${field}`);
  }
}

export class PropertyGeolocation {
  private constructor(readonly values: Readonly<PropertyGeolocationValues>) {}

  static create(input: PropertyGeolocationValues): PropertyGeolocation {
    try {
      return new PropertyGeolocation(validate(input));
    } catch (error) {
      if (!(error instanceof PropertyGeolocationInvariantViolation)) throw error;
      if (error.field === "propertyId" || error.field === "tenantId") {
        throw new InvalidPropertyGeolocationServerValueError(error.field);
      }
      throw new InvalidPropertyGeolocationInputError(error.field);
    }
  }

  static rehydrate(input: PropertyGeolocationValues): PropertyGeolocation {
    try {
      return new PropertyGeolocation(validate(input));
    } catch (error) {
      if (error instanceof PropertyGeolocationInvariantViolation) {
        throw new PersistedPropertyGeolocationCorruptionError(error.field);
      }
      throw error;
    }
  }

  samePositionAs(other: PropertyGeolocation): boolean {
    return this.values.latitude === other.values.latitude
      && this.values.longitude === other.values.longitude
      && this.values.publicVisibility === other.values.publicVisibility;
  }

  publicPosition(): PropertyPublicPosition | undefined {
    if (this.values.publicVisibility === "HIDDEN") return undefined;
    if (this.values.publicVisibility === "EXACT") {
      return Object.freeze({
        latitude: this.values.latitude,
        longitude: this.values.longitude,
        precision: "EXACT",
      });
    }
    return Object.freeze({
      latitude: roundedForPublicDisplay(this.values.latitude),
      longitude: roundedForPublicDisplay(this.values.longitude),
      precision: "APPROXIMATE",
    });
  }
}

function validate(input: PropertyGeolocationValues): Readonly<PropertyGeolocationValues> {
  if (!UUID_V4.test(input.propertyId)) throw new PropertyGeolocationInvariantViolation("propertyId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyGeolocationInvariantViolation("tenantId");
  if (!validCoordinate(input.latitude, -90, 90)) throw new PropertyGeolocationInvariantViolation("latitude");
  if (!validCoordinate(input.longitude, -180, 180)) throw new PropertyGeolocationInvariantViolation("longitude");
  if (!PROPERTY_GEOLOCATION_PUBLIC_VISIBILITIES.includes(input.publicVisibility)) {
    throw new PropertyGeolocationInvariantViolation("publicVisibility");
  }
  return Object.freeze({ ...input });
}

function validCoordinate(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value)
    && value >= minimum
    && value <= maximum
    && Number(value.toFixed(CANONICAL_DECIMALS)) === value;
}

function roundedForPublicDisplay(value: number): number {
  const rounded = Number(value.toFixed(APPROXIMATE_DECIMALS));
  return Object.is(rounded, -0) ? 0 : rounded;
}
