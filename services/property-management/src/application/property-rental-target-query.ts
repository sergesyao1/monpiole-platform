import type { BuildingCommercializationMode, PropertyStructuralRole } from "../domain/property.js";

export type PropertyRentalMode = "LONG_TERM_RENTAL" | "SHORT_TERM_RENTAL";

export interface PropertyRentalTarget {
  readonly propertyId: string;
  readonly rentalMode: PropertyRentalMode;
  readonly structuralRole: PropertyStructuralRole;
  readonly commercializationMode?: BuildingCommercializationMode;
  readonly conflictScopeIds: readonly string[];
}

export interface PropertyRentalTargetQuery {
  resolveMany(tenantId: string, propertyIds: readonly string[]): Promise<readonly PropertyRentalTarget[]>;
}
