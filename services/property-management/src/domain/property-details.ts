const CURRENCY = /^[A-Z]{3}$/u;
export const SUPPORTED_PROPERTY_CURRENCIES = ["XOF"] as const;
export const MAXIMUM_STAY_NIGHTS = 2_147_483_647;

export interface PropertyDetails {
  readonly usableSurfaceSquareMeters?: number;
  readonly rooms?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly furnished?: boolean;
}

interface Money {
  readonly currency: string;
}

export interface LongTermRentalTerms extends Money {
  readonly kind: "LONG_TERM_RENTAL";
  readonly rentAmountMinor: number;
  readonly rentPeriod: "MONTH";
  readonly securityDepositAmountMinor?: number;
  readonly chargesAmountMinor?: number;
  readonly agencyFeeAmountMinor?: number;
}

export interface ShortTermRentalTerms extends Money {
  readonly kind: "SHORT_TERM_RENTAL";
  readonly rateAmountMinor: number;
  readonly pricingUnit: "NIGHT" | "WEEK";
  readonly cleaningFeeAmountMinor?: number;
  readonly securityDepositAmountMinor?: number;
  readonly minimumStayNights?: number;
}

export interface SaleTerms extends Money {
  readonly kind: "SALE";
  readonly salePriceAmountMinor: number;
  readonly agencyFeeAmountMinor?: number;
}

export type CommercialTerms = LongTermRentalTerms | ShortTermRentalTerms | SaleTerms;
export type PropertyPricing = CommercialTerms;

export class InvalidPropertyDetailsError extends Error {
  readonly code = "INVALID_PROPERTY_DETAILS";
  constructor(readonly field: string) { super(`Invalid property details ${field}`); }
}

export class IncompatibleCommercialTermsError extends Error {
  readonly code = "INCOMPATIBLE_COMMERCIAL_TERMS";
}

export function validatePropertyDetails(input: PropertyDetails): PropertyDetails {
  if (Object.keys(input).length === 0) throw new InvalidPropertyDetailsError("details");
  if (input.usableSurfaceSquareMeters !== undefined && (!Number.isFinite(input.usableSurfaceSquareMeters) || input.usableSurfaceSquareMeters <= 0)) {
    throw new InvalidPropertyDetailsError("usableSurfaceSquareMeters");
  }
  for (const [field, value] of [["rooms", input.rooms], ["bedrooms", input.bedrooms], ["bathrooms", input.bathrooms]] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new InvalidPropertyDetailsError(field);
  }
  if (input.rooms !== undefined && input.bedrooms !== undefined && input.bedrooms > input.rooms) {
    throw new InvalidPropertyDetailsError("bedrooms");
  }
  return Object.freeze({ ...input });
}

export function validateCommercialTerms(transactionType: CommercialTerms["kind"], input: CommercialTerms): CommercialTerms {
  return validateTerms(transactionType, input, false);
}

export function validatePersistedCommercialTerms(
  transactionType: CommercialTerms["kind"],
  input: CommercialTerms,
  allowLegacyPricing: boolean,
): CommercialTerms {
  return validateTerms(transactionType, input, allowLegacyPricing);
}

export function sameCommercialTerms(left: CommercialTerms | undefined, right: CommercialTerms): boolean {
  if (left?.kind !== right.kind || left.currency !== right.currency) return false;
  if (left.kind === "LONG_TERM_RENTAL" && right.kind === "LONG_TERM_RENTAL") {
    return left.rentAmountMinor === right.rentAmountMinor
      && left.rentPeriod === right.rentPeriod
      && left.securityDepositAmountMinor === right.securityDepositAmountMinor
      && left.chargesAmountMinor === right.chargesAmountMinor
      && left.agencyFeeAmountMinor === right.agencyFeeAmountMinor;
  }
  if (left.kind === "SHORT_TERM_RENTAL" && right.kind === "SHORT_TERM_RENTAL") {
    return left.rateAmountMinor === right.rateAmountMinor
      && left.pricingUnit === right.pricingUnit
      && left.cleaningFeeAmountMinor === right.cleaningFeeAmountMinor
      && left.securityDepositAmountMinor === right.securityDepositAmountMinor
      && left.minimumStayNights === right.minimumStayNights;
  }
  return left.kind === "SALE" && right.kind === "SALE"
    && left.salePriceAmountMinor === right.salePriceAmountMinor
    && left.agencyFeeAmountMinor === right.agencyFeeAmountMinor;
}

function validateTerms(
  transactionType: CommercialTerms["kind"],
  input: CommercialTerms,
  allowLegacyPricing: boolean,
): CommercialTerms {
  if (input.kind !== transactionType) throw new IncompatibleCommercialTermsError();
  if (!CURRENCY.test(input.currency) || (!allowLegacyPricing && input.currency !== SUPPORTED_PROPERTY_CURRENCIES[0])) {
    throw new InvalidPropertyDetailsError("currency");
  }
  if (input.kind === "LONG_TERM_RENTAL") {
    primaryAmount(input.rentAmountMinor, "rentAmountMinor", allowLegacyPricing);
    if (input.rentPeriod !== "MONTH") throw new InvalidPropertyDetailsError("rentPeriod");
    optionalAmount(input.securityDepositAmountMinor, "securityDepositAmountMinor");
    optionalAmount(input.chargesAmountMinor, "chargesAmountMinor");
    optionalAmount(input.agencyFeeAmountMinor, "agencyFeeAmountMinor");
  } else if (input.kind === "SHORT_TERM_RENTAL") {
    primaryAmount(input.rateAmountMinor, "rateAmountMinor", allowLegacyPricing);
    if (input.pricingUnit !== "NIGHT" && input.pricingUnit !== "WEEK") throw new InvalidPropertyDetailsError("pricingUnit");
    optionalAmount(input.cleaningFeeAmountMinor, "cleaningFeeAmountMinor");
    optionalAmount(input.securityDepositAmountMinor, "securityDepositAmountMinor");
    if (input.minimumStayNights !== undefined
      && (!Number.isSafeInteger(input.minimumStayNights) || input.minimumStayNights < 1
        || input.minimumStayNights > MAXIMUM_STAY_NIGHTS)) {
      throw new InvalidPropertyDetailsError("minimumStayNights");
    }
  } else {
    primaryAmount(input.salePriceAmountMinor, "salePriceAmountMinor", allowLegacyPricing);
    optionalAmount(input.agencyFeeAmountMinor, "agencyFeeAmountMinor");
  }
  return Object.freeze({ ...input });
}

function amount(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new InvalidPropertyDetailsError(field);
}
function primaryAmount(value: number, field: string, allowZero: boolean) {
  amount(value, field);
  if (!allowZero && value === 0) throw new InvalidPropertyDetailsError(field);
}
function optionalAmount(value: number | undefined, field: string) {
  if (value !== undefined) amount(value, field);
}
