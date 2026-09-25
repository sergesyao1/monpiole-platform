const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface PropertyClientValues {
  readonly clientId: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PropertyClientField = "clientId" | "tenantId" | "displayName" | "email" | "phoneNumber"
  | "createdAt" | "updatedAt";

class PropertyClientInvariantViolation extends Error {
  constructor(readonly field: PropertyClientField) { super(`Invalid Property client ${field}`); }
}

export class InvalidPropertyClientInputError extends Error {
  readonly code = "INVALID_PROPERTY_CLIENT_INPUT";
  constructor(readonly field: PropertyClientField) { super(`Invalid Property client ${field}`); }
}

export class InvalidPropertyClientServerValueError extends Error {
  constructor(readonly field: PropertyClientField) { super(`Invalid server Property client ${field}`); }
}

export class PersistedPropertyClientCorruptionError extends Error {
  constructor(readonly field: PropertyClientField) { super(`Invalid persisted Property client ${field}`); }
}

export class PropertyClient {
  private constructor(readonly values: Readonly<PropertyClientValues>) {}

  static create(input: PropertyClientValues): PropertyClient {
    try {
      return new PropertyClient(validate(input));
    } catch (error) {
      if (!(error instanceof PropertyClientInvariantViolation)) throw error;
      if (["clientId", "tenantId", "createdAt", "updatedAt"].includes(error.field)) {
        throw new InvalidPropertyClientServerValueError(error.field);
      }
      throw new InvalidPropertyClientInputError(error.field);
    }
  }

  static rehydrate(input: PropertyClientValues): PropertyClient {
    try {
      return new PropertyClient(validate(input));
    } catch (error) {
      if (error instanceof PropertyClientInvariantViolation) throw new PersistedPropertyClientCorruptionError(error.field);
      throw error;
    }
  }
}

function validate(input: PropertyClientValues): Readonly<PropertyClientValues> {
  if (!UUID_V4.test(input.clientId)) throw new PropertyClientInvariantViolation("clientId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyClientInvariantViolation("tenantId");
  const displayName = normalizedRequired(input.displayName, "displayName", 200);
  const email = input.email === undefined ? undefined : input.email.trim().toLowerCase();
  if (email !== undefined && (email.length > 320 || !EMAIL.test(email))) {
    throw new PropertyClientInvariantViolation("email");
  }
  const phoneNumber = input.phoneNumber === undefined
    ? undefined
    : normalizedRequired(input.phoneNumber, "phoneNumber", 100);
  if (!validInstant(input.createdAt)) throw new PropertyClientInvariantViolation("createdAt");
  if (!validInstant(input.updatedAt) || Date.parse(input.updatedAt) < Date.parse(input.createdAt)) {
    throw new PropertyClientInvariantViolation("updatedAt");
  }
  return Object.freeze({
    ...input,
    displayName,
    ...(email === undefined ? {} : { email }),
    ...(phoneNumber === undefined ? {} : { phoneNumber }),
  });
}

function normalizedRequired(value: string, field: PropertyClientField, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) throw new PropertyClientInvariantViolation(field);
  return normalized;
}

function validInstant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
