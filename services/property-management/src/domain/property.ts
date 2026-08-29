import {
  IncompatibleCommercialTermsError,
  InvalidPropertyDetailsError,
  validateCommercialTerms,
  validatePropertyDetails,
  type CommercialTerms,
  type PropertyDetails,
} from "./property-details.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COUNTRY = /^[A-Z]{2}$/u;

export const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export const TRANSACTION_TYPES = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];
export type TransactionType = typeof TRANSACTION_TYPES[number];
export type PropertyStatus = "DRAFT";
export const PROPERTY_STRUCTURAL_ROLES = ["STANDALONE", "COMPOSITE", "UNIT"] as const;
export type PropertyStructuralRole = typeof PROPERTY_STRUCTURAL_ROLES[number];

export interface PropertyLocation {
  readonly country: string;
  readonly city: string;
  readonly district: string;
  readonly addressLine: string;
}

export interface PropertyValues {
  readonly propertyId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly status: PropertyStatus;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly details?: PropertyDetails;
  readonly commercialTerms?: CommercialTerms;
}

export interface PropertyCoreInformation {
  readonly title: string;
  readonly description?: string;
  readonly location: PropertyLocation;
}

type PropertyField = keyof PropertyValues | keyof PropertyLocation;

class PropertyInvariantViolation extends Error {
  constructor(readonly field: PropertyField) { super(`Invalid property ${field}`); }
}

export class InvalidPropertyInputError extends Error {
  readonly code = "INVALID_PROPERTY_INPUT";
  constructor(readonly field: PropertyField) {
    super(`Invalid property ${field}`);
  }
}

export class InvalidPropertyServerValueError extends Error {
  constructor(readonly field: PropertyField) { super(`Invalid server property ${field}`); }
}

export class PersistedPropertyCorruptionError extends Error {
  constructor(readonly field: string) { super(`Invalid persisted property ${field}`); }
}

export class Property {
  private constructor(readonly values: Readonly<PropertyValues>) {}

  static create(input: Omit<PropertyValues, "status" | "structuralRole">): Property {
    return Property.createStandalone(input);
  }

  static createStandalone(input: Omit<PropertyValues, "status" | "structuralRole">): Property {
    return Property.createWithStructuralRole(input, "STANDALONE");
  }

  static createUnit(input: Omit<PropertyValues, "status" | "structuralRole">): Property {
    return Property.createWithStructuralRole(input, "UNIT");
  }

  private static createWithStructuralRole(
    input: Omit<PropertyValues, "status" | "structuralRole">,
    structuralRole: "STANDALONE" | "UNIT",
  ): Property {
    try {
      return new Property(validate({ ...input, structuralRole, status: "DRAFT" }));
    } catch (error) {
      if (!(error instanceof PropertyInvariantViolation)) throw error;
      if (["propertyId", "tenantId", "status", "createdAt", "updatedAt"].includes(error.field)) {
        throw new InvalidPropertyServerValueError(error.field);
      }
      throw new InvalidPropertyInputError(error.field);
    }
  }

  static rehydrate(input: PropertyValues): Property {
    try {
      return new Property(validate(input));
    } catch (error) {
      if (error instanceof PropertyInvariantViolation || error instanceof InvalidPropertyDetailsError) {
        throw new PersistedPropertyCorruptionError(error.field);
      }
      if (error instanceof IncompatibleCommercialTermsError) throw new PersistedPropertyCorruptionError("commercialTerms");
      throw error;
    }
  }

  defineDetails(details: PropertyDetails, commercialTerms: CommercialTerms, updatedAt: string): Property {
    if (!validInstant(updatedAt)) throw new InvalidPropertyServerValueError("updatedAt");
    return new Property(Object.freeze({
      ...this.values,
      details: validatePropertyDetails(details),
      commercialTerms: validateCommercialTerms(this.values.transactionType, commercialTerms),
      updatedAt,
    }));
  }

  updateCoreInformation(information: PropertyCoreInformation, updatedAt: string): Property {
    if (!validInstant(updatedAt)) throw new InvalidPropertyServerValueError("updatedAt");
    try {
      const { description: _previousDescription, ...unchanged } = this.values;
      return new Property(validate({ ...unchanged, ...information, updatedAt }));
    } catch (error) {
      if (!(error instanceof PropertyInvariantViolation)) throw error;
      throw new InvalidPropertyInputError(error.field);
    }
  }


  becomeComposite(updatedAt: string): Property {
    if (this.values.structuralRole === "UNIT") throw new PropertyStructuralRoleConflictError();
    if (this.values.structuralRole === "COMPOSITE") return this;
    if (!validInstant(updatedAt)) throw new InvalidPropertyServerValueError("updatedAt");
    return new Property(Object.freeze({ ...this.values, structuralRole: "COMPOSITE", updatedAt }));
  }
}

export class PropertyStructuralRoleConflictError extends Error {
  readonly code = "PROPERTY_COMPOSITION_ROLE_CONFLICT";
}

function validate(input: PropertyValues): Readonly<PropertyValues> {
  if (!UUID_V4.test(input.propertyId)) throw new PropertyInvariantViolation("propertyId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyInvariantViolation("tenantId");
  const title = normalizedRequired(input.title, "title", 200);
  const description = input.description === undefined ? undefined : input.description.trim();
  if (description !== undefined && description.length > 5_000) throw new PropertyInvariantViolation("description");
  if (!PROPERTY_TYPES.includes(input.propertyType)) throw new PropertyInvariantViolation("propertyType");
  if (!TRANSACTION_TYPES.includes(input.transactionType)) throw new PropertyInvariantViolation("transactionType");
  if (input.status !== "DRAFT") throw new PropertyInvariantViolation("status");
  if (!PROPERTY_STRUCTURAL_ROLES.includes(input.structuralRole)) throw new PropertyInvariantViolation("structuralRole");
  if (!COUNTRY.test(input.location.country)) throw new PropertyInvariantViolation("country");
  const location = Object.freeze({
    country: input.location.country,
    city: normalizedRequired(input.location.city, "city", 200),
    district: normalizedRequired(input.location.district, "district", 200),
    addressLine: normalizedRequired(input.location.addressLine, "addressLine", 200),
  });
  if (!validInstant(input.createdAt)) throw new PropertyInvariantViolation("createdAt");
  if (!validInstant(input.updatedAt)) throw new PropertyInvariantViolation("updatedAt");
  const details = input.details === undefined ? undefined : validatePropertyDetails(input.details);
  const commercialTerms = input.commercialTerms === undefined
    ? undefined
    : validateCommercialTerms(input.transactionType, input.commercialTerms);
  if ((details === undefined) !== (commercialTerms === undefined)) throw new PropertyInvariantViolation("details");
  return Object.freeze({ ...input, title, description, location, details, commercialTerms });
}

function normalizedRequired(value: string, field: "title" | "city" | "district" | "addressLine", maximum: number) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) throw new PropertyInvariantViolation(field);
  return normalized;
}

function validInstant(value: string) {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
