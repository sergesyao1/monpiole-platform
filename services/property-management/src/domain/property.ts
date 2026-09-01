import {
  IncompatibleCommercialTermsError,
  InvalidPropertyDetailsError,
  validateCommercialTerms,
  validatePropertyDetails,
  type CommercialTerms,
  type PropertyDetails,
} from "./property-details.js";
import {
  assessPropertyPhotoReadiness,
  resolvePropertyPhotoStandard,
  type PropertyPhotoStandardOverride,
  type PropertyPhotoValues,
} from "./property-photo.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COUNTRY = /^[A-Z]{2}$/u;

export const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export const TRANSACTION_TYPES = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];
export type TransactionType = typeof TRANSACTION_TYPES[number];
export const APARTMENT_SUBTYPES = ["STUDIO", "MULTI_ROOM"] as const;
export type ApartmentSubtype = typeof APARTMENT_SUBTYPES[number];
export const PROPERTY_STATUSES = ["DRAFT", "PUBLISHED", "WITHDRAWN"] as const;
export type PropertyStatus = typeof PROPERTY_STATUSES[number];
export const PROPERTY_STRUCTURAL_ROLES = ["STANDALONE", "COMPOSITE", "UNIT"] as const;
export type PropertyStructuralRole = typeof PROPERTY_STRUCTURAL_ROLES[number];
export const PROPERTY_AVAILABILITY_STATUSES = ["AVAILABLE", "UNAVAILABLE"] as const;
export type PropertyAvailabilityStatus = typeof PROPERTY_AVAILABILITY_STATUSES[number];
export const PROPERTY_OCCUPANCY_STATUSES = ["VACANT", "OCCUPIED"] as const;
export type PropertyOccupancyStatus = typeof PROPERTY_OCCUPANCY_STATUSES[number];

export interface PropertyAvailabilitySnapshot {
  readonly availabilityStatus: PropertyAvailabilityStatus;
  readonly occupancyStatus: PropertyOccupancyStatus;
  readonly updatedAt: string;
}

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
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly status: PropertyStatus;
  readonly publishedAt?: string;
  readonly withdrawnAt?: string;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly details?: PropertyDetails;
  readonly commercialTerms?: CommercialTerms;
  readonly photos?: readonly PropertyPhotoValues[];
  readonly availability?: PropertyAvailabilitySnapshot;
}

export interface PropertyCoreInformation {
  readonly title: string;
  readonly description?: string;
  readonly location: PropertyLocation;
  readonly apartmentSubtype?: ApartmentSubtype;
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

  static create(input: Omit<PropertyValues, "status" | "structuralRole" | "publishedAt" | "withdrawnAt" | "availability">): Property {
    return Property.createStandalone(input);
  }

  static createStandalone(input: Omit<PropertyValues, "status" | "structuralRole" | "publishedAt" | "withdrawnAt" | "availability">): Property {
    return Property.createWithStructuralRole(input, "STANDALONE");
  }

  static createUnit(input: Omit<PropertyValues, "status" | "structuralRole" | "publishedAt" | "withdrawnAt" | "availability">): Property {
    return Property.createWithStructuralRole(input, "UNIT");
  }

  private static createWithStructuralRole(
    input: Omit<PropertyValues, "status" | "structuralRole" | "publishedAt" | "withdrawnAt" | "availability">,
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

  publish(
    publishedAt: string,
    photos: readonly PropertyPhotoValues[] = this.values.photos ?? [],
    standardOverride?: PropertyPhotoStandardOverride,
  ): Property {
    if (this.values.status === "PUBLISHED") return this;
    if (this.values.status === "WITHDRAWN") throw new PropertyRepublicationNotSupportedError();
    const missingRequirements: PropertyPublicationRequirement[] = [];
    if (this.values.details === undefined) missingRequirements.push("DETAILS");
    if (this.values.commercialTerms === undefined) missingRequirements.push("COMMERCIAL_TERMS");
    if (this.values.propertyType === "APARTMENT" && this.values.transactionType === "LONG_TERM_RENTAL"
      && this.values.apartmentSubtype === undefined) missingRequirements.push("APARTMENT_SUBTYPE");
    const photoReadiness = assessPropertyPhotoReadiness(photos, resolvePropertyPhotoStandard({
      propertyType: this.values.propertyType,
      transactionType: this.values.transactionType,
      ...(this.values.apartmentSubtype === undefined ? {} : { apartmentSubtype: this.values.apartmentSubtype }),
    }, standardOverride));
    if (photoReadiness.primaryPhoto === undefined) missingRequirements.push("PRIMARY_PHOTO");
    if (photoReadiness.availableCount < photoReadiness.minimumCount) missingRequirements.push("PHOTO_MINIMUM");
    if (photoReadiness.missingRequiredCategories.length > 0) missingRequirements.push("PHOTO_REQUIRED_VIEWS");
    if (missingRequirements.length > 0) throw new PropertyPublicationRequirementsNotMetError(missingRequirements);
    if (!validInstant(publishedAt)) throw new InvalidPropertyServerValueError("publishedAt");
    return new Property(Object.freeze({
      ...this.values,
      status: "PUBLISHED",
      publishedAt,
      updatedAt: publishedAt,
    }));
  }

  withdraw(withdrawnAt: string): Property {
    if (this.values.status === "WITHDRAWN") return this;
    if (this.values.status === "DRAFT") throw new PropertyNotPublishedError();
    if (!validInstant(withdrawnAt) || Date.parse(withdrawnAt) < Date.parse(this.values.publishedAt!)) {
      throw new InvalidPropertyServerValueError("withdrawnAt");
    }
    return new Property(Object.freeze({
      ...this.values,
      status: "WITHDRAWN",
      withdrawnAt,
      updatedAt: withdrawnAt,
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

  defineAvailability(
    availabilityStatus: PropertyAvailabilityStatus,
    occupancyStatus: PropertyOccupancyStatus,
    updatedAt: string,
  ): Property {
    if (this.values.structuralRole === "COMPOSITE") throw new PropertyAvailabilityDerivedFromUnitsError();
    if (!PROPERTY_AVAILABILITY_STATUSES.includes(availabilityStatus)
      || !PROPERTY_OCCUPANCY_STATUSES.includes(occupancyStatus)) {
      throw new InvalidPropertyInputError("availability");
    }
    if (this.values.availability?.availabilityStatus === availabilityStatus
      && this.values.availability.occupancyStatus === occupancyStatus) return this;
    if (!validInstant(updatedAt)) throw new InvalidPropertyServerValueError("updatedAt");
    return new Property(Object.freeze({
      ...this.values,
      availability: Object.freeze({ availabilityStatus, occupancyStatus, updatedAt }),
      updatedAt,
    }));
  }


  becomeComposite(updatedAt: string): Property {
    if (this.values.structuralRole === "UNIT") throw new PropertyStructuralRoleConflictError();
    if (this.values.structuralRole === "COMPOSITE") return this;
    if (!validInstant(updatedAt)) throw new InvalidPropertyServerValueError("updatedAt");
    const { availability: _availability, ...values } = this.values;
    return new Property(Object.freeze({ ...values, structuralRole: "COMPOSITE", updatedAt }));
  }
}

export class PropertyStructuralRoleConflictError extends Error {
  readonly code = "PROPERTY_COMPOSITION_ROLE_CONFLICT";
}

export class PropertyAvailabilityDerivedFromUnitsError extends Error {
  readonly code = "PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS";
  constructor() { super("Composite Property availability is derived from its Units"); }
}

export type PropertyPublicationRequirement =
  | "DETAILS"
  | "COMMERCIAL_TERMS"
  | "APARTMENT_SUBTYPE"
  | "PRIMARY_PHOTO"
  | "PHOTO_MINIMUM"
  | "PHOTO_REQUIRED_VIEWS";

export class PropertyPublicationRequirementsNotMetError extends Error {
  readonly code = "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET";
  constructor(readonly missingRequirements: readonly PropertyPublicationRequirement[]) {
    super("Property publication requirements are not met");
  }
}

export class PropertyNotPublishedError extends Error {
  readonly code = "PROPERTY_NOT_PUBLISHED";
  constructor() { super("Property is not published"); }
}

export class PropertyRepublicationNotSupportedError extends Error {
  readonly code = "PROPERTY_REPUBLICATION_NOT_SUPPORTED";
  constructor() { super("Property republication is not supported"); }
}

function validate(input: PropertyValues): Readonly<PropertyValues> {
  if (!UUID_V4.test(input.propertyId)) throw new PropertyInvariantViolation("propertyId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyInvariantViolation("tenantId");
  const title = normalizedRequired(input.title, "title", 200);
  const description = input.description === undefined ? undefined : input.description.trim();
  if (description !== undefined && description.length > 5_000) throw new PropertyInvariantViolation("description");
  if (!PROPERTY_TYPES.includes(input.propertyType)) throw new PropertyInvariantViolation("propertyType");
  if (!TRANSACTION_TYPES.includes(input.transactionType)) throw new PropertyInvariantViolation("transactionType");
  if (input.apartmentSubtype !== undefined && !APARTMENT_SUBTYPES.includes(input.apartmentSubtype)) {
    throw new PropertyInvariantViolation("apartmentSubtype");
  }
  if ((input.propertyType !== "APARTMENT" || input.transactionType !== "LONG_TERM_RENTAL")
    && input.apartmentSubtype !== undefined) throw new PropertyInvariantViolation("apartmentSubtype");
  if (!PROPERTY_STATUSES.includes(input.status)) throw new PropertyInvariantViolation("status");
  if (!PROPERTY_STRUCTURAL_ROLES.includes(input.structuralRole)) throw new PropertyInvariantViolation("structuralRole");
  if (input.structuralRole === "COMPOSITE" && input.availability !== undefined) {
    throw new PropertyInvariantViolation("availability");
  }
  const availability = input.availability === undefined ? undefined : Object.freeze({
    availabilityStatus: input.availability.availabilityStatus,
    occupancyStatus: input.availability.occupancyStatus,
    updatedAt: input.availability.updatedAt,
  });
  if (availability !== undefined
    && (!PROPERTY_AVAILABILITY_STATUSES.includes(availability.availabilityStatus)
      || !PROPERTY_OCCUPANCY_STATUSES.includes(availability.occupancyStatus)
      || !validInstant(availability.updatedAt))) throw new PropertyInvariantViolation("availability");
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
  if (input.status === "DRAFT" && (input.publishedAt !== undefined || input.withdrawnAt !== undefined)) {
    throw new PropertyInvariantViolation(input.publishedAt !== undefined ? "publishedAt" : "withdrawnAt");
  }
  if (input.status === "PUBLISHED") {
    if (details === undefined || commercialTerms === undefined) throw new PropertyInvariantViolation("status");
    if (input.publishedAt === undefined || !validInstant(input.publishedAt)) throw new PropertyInvariantViolation("publishedAt");
    if (input.withdrawnAt !== undefined) throw new PropertyInvariantViolation("withdrawnAt");
  }
  if (input.status === "WITHDRAWN") {
    if (details === undefined || commercialTerms === undefined) throw new PropertyInvariantViolation("status");
    if (input.publishedAt === undefined || !validInstant(input.publishedAt)) throw new PropertyInvariantViolation("publishedAt");
    if (input.withdrawnAt === undefined || !validInstant(input.withdrawnAt)
      || Date.parse(input.withdrawnAt) < Date.parse(input.publishedAt)) throw new PropertyInvariantViolation("withdrawnAt");
  }
  return Object.freeze({ ...input, title, description, location, details, commercialTerms, availability });
}

function normalizedRequired(value: string, field: "title" | "city" | "district" | "addressLine", maximum: number) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) throw new PropertyInvariantViolation(field);
  return normalized;
}

function validInstant(value: string) {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
