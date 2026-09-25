import type { PropertyContractRecord } from "./property-contract-repository.js";

export interface ApplicationContractTerms {
  readonly reference: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly notes?: string;
}

export type CreateApplicationContractResult =
  | { readonly kind: "CREATED" | "EXISTING"; readonly record: PropertyContractRecord }
  | { readonly kind: "NOT_FOUND" | "NOT_CONVERTED" | "NOT_ELIGIBLE" | "INCOMPATIBLE_REPLAY" };

export interface PropertyApplicationContractRepository {
  create(input: Readonly<ApplicationContractTerms & {
    tenantId: string; propertyId: string; applicationId: string; contractId: string;
    createdAt: string; actorId: string; correlationId: string;
  }>): Promise<CreateApplicationContractResult>;
}
