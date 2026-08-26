const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHARE_SCALE = 100;
const MAX_SHARE_UNITS = 100 * SHARE_SCALE;

export interface PropertyOwnershipValues {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly ownerId: string;
  readonly ownershipShare: number;
  readonly createdAt: string;
  readonly correlationId: string;
  readonly actorId: string;
}

type PropertyOwnershipField = keyof PropertyOwnershipValues;

class PropertyOwnershipInvariantViolation extends Error {
  constructor(readonly field: PropertyOwnershipField) { super(`Invalid property ownership ${field}`); }
}

export class InvalidPropertyOwnershipInputError extends Error {
  readonly code = "INVALID_PROPERTY_OWNERSHIP_INPUT";
  constructor(readonly field: PropertyOwnershipField) { super(`Invalid property ownership ${field}`); }
}

export class InvalidPropertyOwnershipServerValueError extends Error {
  constructor(readonly field: PropertyOwnershipField) { super(`Invalid server property ownership ${field}`); }
}

export class PersistedPropertyOwnershipCorruptionError extends Error {
  constructor(readonly field: PropertyOwnershipField) { super(`Invalid persisted property ownership ${field}`); }
}

export class PropertyOwnershipShareExceededError extends Error {
  readonly code = "PROPERTY_OWNERSHIP_SHARE_EXCEEDED";
}

export class PropertyOwnership {
  private constructor(readonly values: Readonly<PropertyOwnershipValues>) {}

  static create(input: PropertyOwnershipValues): PropertyOwnership {
    try { return new PropertyOwnership(validate(input)); }
    catch (error) {
      if (!(error instanceof PropertyOwnershipInvariantViolation)) throw error;
      if (["tenantId", "createdAt", "correlationId", "actorId"].includes(error.field)) {
        throw new InvalidPropertyOwnershipServerValueError(error.field);
      }
      throw new InvalidPropertyOwnershipInputError(error.field);
    }
  }

  static rehydrate(input: PropertyOwnershipValues): PropertyOwnership {
    try { return new PropertyOwnership(validate(input)); }
    catch (error) {
      if (error instanceof PropertyOwnershipInvariantViolation) throw new PersistedPropertyOwnershipCorruptionError(error.field);
      throw error;
    }
  }
}

export function assertOwnershipShareCapacity(existingShares: readonly number[], newShare: number): void {
  const totalUnits = existingShares.reduce((total, share) => total + shareUnits(share), 0) + shareUnits(newShare);
  if (totalUnits > MAX_SHARE_UNITS) throw new PropertyOwnershipShareExceededError();
}

function validate(input: PropertyOwnershipValues): Readonly<PropertyOwnershipValues> {
  for (const field of ["tenantId", "propertyId", "ownerId", "correlationId"] as const) {
    if (!UUID_V4.test(input[field])) throw new PropertyOwnershipInvariantViolation(field);
  }
  const ownershipShare = shareUnits(input.ownershipShare) / SHARE_SCALE;
  if (!validInstant(input.createdAt)) throw new PropertyOwnershipInvariantViolation("createdAt");
  const actorId = input.actorId.trim();
  if (actorId.length === 0 || actorId.length > 500) throw new PropertyOwnershipInvariantViolation("actorId");
  return Object.freeze({ ...input, ownershipShare, actorId });
}

function shareUnits(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 100) throw new PropertyOwnershipInvariantViolation("ownershipShare");
  const scaled = value * SHARE_SCALE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4) {
    throw new PropertyOwnershipInvariantViolation("ownershipShare");
  }
  return rounded;
}

function validInstant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
