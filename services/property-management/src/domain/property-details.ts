const CURRENCY = /^[A-Z]{3}$/u;

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
}

export interface ShortTermRentalTerms extends Money {
  readonly kind: "SHORT_TERM_RENTAL";
  readonly rateAmountMinor: number;
  readonly pricingUnit: "NIGHT" | "WEEK";
}

export interface SaleTerms extends Money {
  readonly kind: "SALE";
  readonly salePriceAmountMinor: number;
}

export type CommercialTerms = LongTermRentalTerms | ShortTermRentalTerms | SaleTerms;

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
  if (input.kind !== transactionType) throw new IncompatibleCommercialTermsError();
  if (!CURRENCY.test(input.currency)) throw new InvalidPropertyDetailsError("currency");
  if (input.kind === "LONG_TERM_RENTAL") {
    amount(input.rentAmountMinor, "rentAmountMinor");
    if (input.rentPeriod !== "MONTH") throw new InvalidPropertyDetailsError("rentPeriod");
    optionalAmount(input.securityDepositAmountMinor, "securityDepositAmountMinor");
    optionalAmount(input.chargesAmountMinor, "chargesAmountMinor");
  } else if (input.kind === "SHORT_TERM_RENTAL") {
    amount(input.rateAmountMinor, "rateAmountMinor");
    if (input.pricingUnit !== "NIGHT" && input.pricingUnit !== "WEEK") throw new InvalidPropertyDetailsError("pricingUnit");
  } else {
    amount(input.salePriceAmountMinor, "salePriceAmountMinor");
  }
  return Object.freeze({ ...input });
}

function amount(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new InvalidPropertyDetailsError(field);
}
function optionalAmount(value: number | undefined, field: string) {
  if (value !== undefined) amount(value, field);
}
