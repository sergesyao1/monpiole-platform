const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const PROPERTY_OWNER_TYPES = ["INDIVIDUAL", "LEGAL_ENTITY"] as const;
export type PropertyOwnerType = typeof PROPERTY_OWNER_TYPES[number];

export interface IndividualOwnerIdentity {
  readonly ownerType: "INDIVIDUAL";
  readonly firstName: string;
  readonly lastName: string;
}

export interface LegalEntityOwnerIdentity {
  readonly ownerType: "LEGAL_ENTITY";
  readonly legalName: string;
  readonly registrationNumber?: string;
}

export type PropertyOwnerIdentity = IndividualOwnerIdentity | LegalEntityOwnerIdentity;

export interface PropertyOwnerContactInformation {
  readonly phoneNumber?: string;
  readonly email?: string;
}

export interface PropertyOwnerValues {
  readonly ownerId: string;
  readonly tenantId: string;
  readonly identity: PropertyOwnerIdentity;
  readonly contactInformation: PropertyOwnerContactInformation;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type PropertyOwnerField = "ownerId" | "tenantId" | "ownerType" | "firstName" | "lastName"
  | "legalName" | "registrationNumber" | "phoneNumber" | "email" | "createdAt" | "updatedAt";

class PropertyOwnerInvariantViolation extends Error {
  constructor(readonly field: PropertyOwnerField) { super(`Invalid property owner ${field}`); }
}

export class InvalidPropertyOwnerInputError extends Error {
  readonly code = "INVALID_PROPERTY_OWNER_INPUT";
  constructor(readonly field: PropertyOwnerField) { super(`Invalid property owner ${field}`); }
}

export class InvalidPropertyOwnerServerValueError extends Error {
  constructor(readonly field: PropertyOwnerField) { super(`Invalid server property owner ${field}`); }
}

export class PersistedPropertyOwnerCorruptionError extends Error {
  constructor(readonly field: PropertyOwnerField) { super(`Invalid persisted property owner ${field}`); }
}

export class PropertyOwnerTypeChangeNotAllowedError extends Error {
  readonly code = "PROPERTY_OWNER_TYPE_CHANGE_NOT_ALLOWED";
}

export class PropertyOwner {
  private constructor(readonly values: Readonly<PropertyOwnerValues>) {}

  static create(input: PropertyOwnerValues): PropertyOwner {
    try {
      return new PropertyOwner(validate(input));
    } catch (error) {
      if (!(error instanceof PropertyOwnerInvariantViolation)) throw error;
      if (["ownerId", "tenantId", "createdAt", "updatedAt"].includes(error.field)) {
        throw new InvalidPropertyOwnerServerValueError(error.field);
      }
      throw new InvalidPropertyOwnerInputError(error.field);
    }
  }

  static rehydrate(input: PropertyOwnerValues): PropertyOwner {
    try {
      return new PropertyOwner(validate(input));
    } catch (error) {
      if (error instanceof PropertyOwnerInvariantViolation) throw new PersistedPropertyOwnerCorruptionError(error.field);
      throw error;
    }
  }

  update(identity: PropertyOwnerIdentity, contactInformation: PropertyOwnerContactInformation, updatedAt: string): PropertyOwner {
    if (identity.ownerType !== this.values.identity.ownerType) throw new PropertyOwnerTypeChangeNotAllowedError();
    if (!validInstant(updatedAt)) throw new InvalidPropertyOwnerServerValueError("updatedAt");
    try {
      return new PropertyOwner(validate({ ...this.values, identity, contactInformation, updatedAt }));
    } catch (error) {
      if (error instanceof PropertyOwnerInvariantViolation) throw new InvalidPropertyOwnerInputError(error.field);
      throw error;
    }
  }
}

function validate(input: PropertyOwnerValues): Readonly<PropertyOwnerValues> {
  if (!UUID_V4.test(input.ownerId)) throw new PropertyOwnerInvariantViolation("ownerId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyOwnerInvariantViolation("tenantId");
  const identity = validateIdentity(input.identity);
  const contactInformation = validateContactInformation(input.contactInformation);
  if (!validInstant(input.createdAt)) throw new PropertyOwnerInvariantViolation("createdAt");
  if (!validInstant(input.updatedAt)) throw new PropertyOwnerInvariantViolation("updatedAt");
  return Object.freeze({ ...input, identity, contactInformation });
}

function validateIdentity(identity: PropertyOwnerIdentity): PropertyOwnerIdentity {
  if (identity.ownerType === "INDIVIDUAL") return Object.freeze({
    ownerType: "INDIVIDUAL",
    firstName: normalizedRequired(identity.firstName, "firstName", 200),
    lastName: normalizedRequired(identity.lastName, "lastName", 200),
  });
  if (identity.ownerType === "LEGAL_ENTITY") return Object.freeze({
    ownerType: "LEGAL_ENTITY",
    legalName: normalizedRequired(identity.legalName, "legalName", 300),
    ...(identity.registrationNumber === undefined
      ? {}
      : { registrationNumber: normalizedOptional(identity.registrationNumber, "registrationNumber", 200) }),
  });
  throw new PropertyOwnerInvariantViolation("ownerType");
}

function validateContactInformation(contact: PropertyOwnerContactInformation): PropertyOwnerContactInformation {
  const phoneNumber = contact.phoneNumber === undefined
    ? undefined
    : normalizedOptional(contact.phoneNumber, "phoneNumber", 100);
  const email = contact.email === undefined ? undefined : contact.email.trim().toLowerCase();
  if (email !== undefined && (email.length > 320 || !EMAIL.test(email))) throw new PropertyOwnerInvariantViolation("email");
  return Object.freeze({ ...(phoneNumber === undefined ? {} : { phoneNumber }), ...(email === undefined ? {} : { email }) });
}

function normalizedRequired(value: string, field: PropertyOwnerField, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) throw new PropertyOwnerInvariantViolation(field);
  return normalized;
}

function normalizedOptional(value: string, field: PropertyOwnerField, maximum: number): string {
  return normalizedRequired(value, field, maximum);
}

function validInstant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
