import type { PropertyClient } from "../domain/property-client.js";

export interface PropertyApplicationClientConversionResult {
  readonly applicationId: string;
  readonly convertedAt: string;
  readonly client: PropertyClient;
}

export type ConvertPropertyApplicationResult =
  | { readonly kind: "CREATED" | "EXISTING"; readonly conversion: PropertyApplicationClientConversionResult }
  | { readonly kind: "NOT_FOUND" | "NOT_ELIGIBLE" };

export interface PropertyApplicationClientConversionRepository {
  convert(input: Readonly<{
    tenantId: string; propertyId: string; applicationId: string; clientId: string;
    convertedAt: string; actorId: string; correlationId: string;
  }>): Promise<ConvertPropertyApplicationResult>;
  find(tenantId: string, propertyId: string, applicationId: string): Promise<PropertyApplicationClientConversionResult | undefined>;
}
