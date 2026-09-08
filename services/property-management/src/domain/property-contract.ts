import type { PropertyStructuralRole, TransactionType } from "./property.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REFERENCE = /^[A-Z0-9][A-Z0-9._/ -]{0,99}$/u;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

export const PROPERTY_CONTRACT_TYPES = ["LEASE", "MANAGEMENT", "OTHER"] as const;
export type PropertyContractType = typeof PROPERTY_CONTRACT_TYPES[number];
export const PROPERTY_CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"] as const;
export type PropertyContractStatus = typeof PROPERTY_CONTRACT_STATUSES[number];

export interface PropertyContractTerms {
  readonly clientId: string;
  readonly contractType: PropertyContractType;
  readonly reference: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly notes?: string;
}

export interface PropertyContractValues extends PropertyContractTerms {
  readonly contractId: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly status: PropertyContractStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly endedAt?: string;
  readonly cancelledAt?: string;
}

export interface PropertyContractPropertyContext {
  readonly structuralRole: PropertyStructuralRole;
  readonly transactionType: TransactionType;
}

export type PropertyContractField = "contractId" | "tenantId" | "propertyId" | "clientId" | "contractType"
  | "status" | "reference" | "startDate" | "endDate" | "notes" | "createdAt" | "updatedAt"
  | "activatedAt" | "endedAt" | "cancelledAt";

class PropertyContractInvariantViolation extends Error {
  constructor(readonly field: PropertyContractField) { super(`Invalid Property contract ${field}`); }
}

export class InvalidPropertyContractInputError extends Error {
  readonly code = "INVALID_PROPERTY_CONTRACT_INPUT";
  constructor(readonly field: PropertyContractField) { super(`Invalid Property contract ${field}`); }
}

export class InvalidPropertyContractServerValueError extends Error {
  constructor(readonly field: PropertyContractField) { super(`Invalid server Property contract ${field}`); }
}

export class PersistedPropertyContractCorruptionError extends Error {
  constructor(readonly field: PropertyContractField) { super(`Invalid persisted Property contract ${field}`); }
}

export class PropertyContractTransitionNotAllowedError extends Error {
  readonly code = "PROPERTY_CONTRACT_TRANSITION_NOT_ALLOWED";
  constructor() { super("Property contract lifecycle transition is not allowed"); }
}

export class PropertyContractUpdateNotAllowedError extends Error {
  readonly code = "PROPERTY_CONTRACT_UPDATE_NOT_ALLOWED";
  constructor() { super("Only a draft Property contract can be updated"); }
}

export class PropertyContractPropertyNotEligibleError extends Error {
  readonly code = "PROPERTY_CONTRACT_PROPERTY_NOT_ELIGIBLE";
  constructor() { super("The Property is not eligible for this contract type"); }
}

export class PropertyContract {
  private constructor(readonly values: Readonly<PropertyContractValues>) {}

  static create(
    input: Omit<PropertyContractValues, "status" | "activatedAt" | "endedAt" | "cancelledAt">,
    property: PropertyContractPropertyContext,
  ): PropertyContract {
    try {
      assertEligible(input.contractType, property);
      return new PropertyContract(validate({ ...input, status: "DRAFT" }));
    } catch (error) {
      if (!(error instanceof PropertyContractInvariantViolation)) throw error;
      if (["contractId", "tenantId", "propertyId", "createdAt", "updatedAt"].includes(error.field)) {
        throw new InvalidPropertyContractServerValueError(error.field);
      }
      throw new InvalidPropertyContractInputError(error.field);
    }
  }

  static rehydrate(input: PropertyContractValues): PropertyContract {
    try {
      return new PropertyContract(validate(input));
    } catch (error) {
      if (error instanceof PropertyContractInvariantViolation) throw new PersistedPropertyContractCorruptionError(error.field);
      throw error;
    }
  }

  update(terms: PropertyContractTerms, property: PropertyContractPropertyContext, updatedAt: string): PropertyContract {
    if (this.values.status !== "DRAFT") throw new PropertyContractUpdateNotAllowedError();
    assertEligible(terms.contractType, property);
    const candidate = inputValues({ ...this.values, ...terms, updatedAt });
    if (sameTerms(this.values, candidate)) return this;
    try {
      return new PropertyContract(validate(candidate));
    } catch (error) {
      if (error instanceof PropertyContractInvariantViolation) {
        if (error.field === "updatedAt") throw new InvalidPropertyContractServerValueError(error.field);
        throw new InvalidPropertyContractInputError(error.field);
      }
      throw error;
    }
  }

  activate(activatedAt: string): PropertyContract {
    if (this.values.status === "ACTIVE") return this;
    if (this.values.status !== "DRAFT") throw new PropertyContractTransitionNotAllowedError();
    if (this.values.startDate === undefined) throw new InvalidPropertyContractInputError("startDate");
    return this.transition({ status: "ACTIVE", activatedAt, updatedAt: activatedAt });
  }

  end(endDate: string, endedAt: string): PropertyContract {
    if (this.values.status === "ENDED" && this.values.endDate === endDate) return this;
    if (this.values.status !== "ACTIVE") throw new PropertyContractTransitionNotAllowedError();
    return this.transition({ status: "ENDED", endDate, endedAt, updatedAt: endedAt });
  }

  cancel(cancelledAt: string): PropertyContract {
    if (this.values.status === "CANCELLED") return this;
    if (this.values.status !== "DRAFT" && this.values.status !== "ACTIVE") {
      throw new PropertyContractTransitionNotAllowedError();
    }
    return this.transition({ status: "CANCELLED", cancelledAt, updatedAt: cancelledAt });
  }

  private transition(changes: Partial<PropertyContractValues>): PropertyContract {
    try {
      return new PropertyContract(validate({ ...this.values, ...changes }));
    } catch (error) {
      if (error instanceof PropertyContractInvariantViolation) {
        if (["updatedAt", "activatedAt", "endedAt", "cancelledAt"].includes(error.field)) {
          throw new InvalidPropertyContractServerValueError(error.field);
        }
        throw new InvalidPropertyContractInputError(error.field);
      }
      throw error;
    }
  }
}

export function assertPropertyContractEligible(
  contractType: PropertyContractType,
  property: PropertyContractPropertyContext,
): void {
  assertEligible(contractType, property);
}

function validate(input: PropertyContractValues): Readonly<PropertyContractValues> {
  if (!UUID_V4.test(input.contractId)) throw new PropertyContractInvariantViolation("contractId");
  if (!UUID_V4.test(input.tenantId)) throw new PropertyContractInvariantViolation("tenantId");
  if (!UUID_V4.test(input.propertyId)) throw new PropertyContractInvariantViolation("propertyId");
  if (!UUID_V4.test(input.clientId)) throw new PropertyContractInvariantViolation("clientId");
  if (!PROPERTY_CONTRACT_TYPES.includes(input.contractType)) throw new PropertyContractInvariantViolation("contractType");
  if (!PROPERTY_CONTRACT_STATUSES.includes(input.status)) throw new PropertyContractInvariantViolation("status");
  const reference = input.reference.trim().toUpperCase();
  if (!REFERENCE.test(reference)) throw new PropertyContractInvariantViolation("reference");
  const startDate = optionalCalendarDate(input.startDate, "startDate");
  const endDate = optionalCalendarDate(input.endDate, "endDate");
  if (startDate !== undefined && endDate !== undefined && endDate < startDate) {
    throw new PropertyContractInvariantViolation("endDate");
  }
  const notes = input.notes === undefined ? undefined : input.notes.trim();
  if (notes !== undefined && (notes.length === 0 || notes.length > 5_000)) {
    throw new PropertyContractInvariantViolation("notes");
  }
  if (!validInstant(input.createdAt)) throw new PropertyContractInvariantViolation("createdAt");
  if (!validInstant(input.updatedAt) || Date.parse(input.updatedAt) < Date.parse(input.createdAt)) {
    throw new PropertyContractInvariantViolation("updatedAt");
  }
  const activatedAt = optionalInstant(input.activatedAt, "activatedAt");
  const endedAt = optionalInstant(input.endedAt, "endedAt");
  const cancelledAt = optionalInstant(input.cancelledAt, "cancelledAt");
  if (activatedAt !== undefined && Date.parse(activatedAt) < Date.parse(input.createdAt)) {
    throw new PropertyContractInvariantViolation("activatedAt");
  }
  if (endedAt !== undefined && (activatedAt === undefined || Date.parse(endedAt) < Date.parse(activatedAt))) {
    throw new PropertyContractInvariantViolation("endedAt");
  }
  if (cancelledAt !== undefined && (Date.parse(cancelledAt) < Date.parse(input.createdAt)
    || (activatedAt !== undefined && Date.parse(cancelledAt) < Date.parse(activatedAt)))) {
    throw new PropertyContractInvariantViolation("cancelledAt");
  }
  const lifecycleValid = input.status === "DRAFT"
    ? activatedAt === undefined && endedAt === undefined && cancelledAt === undefined
    : input.status === "ACTIVE"
      ? activatedAt !== undefined && endedAt === undefined && cancelledAt === undefined
      : input.status === "ENDED"
        ? activatedAt !== undefined && endedAt !== undefined && cancelledAt === undefined && endDate !== undefined
        : endedAt === undefined && cancelledAt !== undefined;
  if (!lifecycleValid) throw new PropertyContractInvariantViolation("status");
  return Object.freeze({
    ...input,
    reference,
    ...(startDate === undefined ? {} : { startDate }),
    ...(endDate === undefined ? {} : { endDate }),
    ...(notes === undefined ? {} : { notes }),
    ...(activatedAt === undefined ? {} : { activatedAt }),
    ...(endedAt === undefined ? {} : { endedAt }),
    ...(cancelledAt === undefined ? {} : { cancelledAt }),
  });
}

function inputValues(input: PropertyContractValues): PropertyContractValues {
  const { startDate, endDate, notes, activatedAt, endedAt, cancelledAt, ...required } = input;
  return {
    ...required,
    ...(startDate === undefined ? {} : { startDate }),
    ...(endDate === undefined ? {} : { endDate }),
    ...(notes === undefined ? {} : { notes }),
    ...(activatedAt === undefined ? {} : { activatedAt }),
    ...(endedAt === undefined ? {} : { endedAt }),
    ...(cancelledAt === undefined ? {} : { cancelledAt }),
  };
}

function sameTerms(left: PropertyContractValues, right: PropertyContractValues): boolean {
  return left.clientId === right.clientId && left.contractType === right.contractType
    && left.reference === right.reference && left.startDate === right.startDate
    && left.endDate === right.endDate && left.notes === right.notes;
}

function assertEligible(contractType: PropertyContractType, property: PropertyContractPropertyContext): void {
  if (contractType === "LEASE"
    && (property.transactionType !== "LONG_TERM_RENTAL" || property.structuralRole === "COMPOSITE")) {
    throw new PropertyContractPropertyNotEligibleError();
  }
}

function optionalCalendarDate(value: string | undefined, field: "startDate" | "endDate"): string | undefined {
  if (value === undefined) return undefined;
  const match = CALENDAR_DATE.exec(value);
  if (match === null) throw new PropertyContractInvariantViolation(field);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PropertyContractInvariantViolation(field);
  }
  return value;
}

function optionalInstant(value: string | undefined, field: "activatedAt" | "endedAt" | "cancelledAt"): string | undefined {
  if (value === undefined) return undefined;
  if (!validInstant(value)) throw new PropertyContractInvariantViolation(field);
  return value;
}

function validInstant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
