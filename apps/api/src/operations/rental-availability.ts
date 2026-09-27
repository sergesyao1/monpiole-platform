import type {
  ListPublicProperties,
  PropertyAuthority,
  PropertyRentalTargetQuery,
  PublicPropertyCatalogDetail,
  PublicPropertyCatalogPage,
  RetrieveProperty,
  RetrievePublicProperty,
} from "@monpiole/property-management";
import type {
  AvailabilityDecision,
  BatchRentableTargetConflictScopeResolver,
  CatalogRentalAvailabilityDisposition,
  CheckRentalAvailability,
  GetCatalogRentalAvailability,
  RentableTargetConflictScope,
  RentableTargetConflictScopeResolver,
  RentalOperationMode,
} from "@monpiole/rental-operations";

export interface RentalAvailabilityResponseModel {
  readonly propertyId: string;
  readonly rentalMode: RentalOperationMode;
  readonly availabilityStatus: "AVAILABLE" | "UNAVAILABLE";
  readonly rentableNow: boolean;
  readonly requestedPeriod: Readonly<{ startsAt: string; endsAt: string }>;
  readonly requestedPeriodAvailable: boolean;
  readonly nextAvailability?: string;
  readonly evaluatedAt: string;
  readonly catalogDisposition: AvailabilityDecision["catalogDisposition"];
  readonly conflictTypes?: ("ALLOCATION" | "OPERATIONAL_BLOCK")[];
}

export class PropertyRentalTargetResolver
implements RentableTargetConflictScopeResolver, BatchRentableTargetConflictScopeResolver {
  constructor(private readonly properties: PropertyRentalTargetQuery) {}

  async resolve(tenantId: string, rentableAssetId: string): Promise<RentableTargetConflictScope | undefined> {
    return (await this.resolveMany(tenantId, [rentableAssetId]))[0];
  }

  async resolveMany(tenantId: string, rentableAssetIds: readonly string[]): Promise<readonly RentableTargetConflictScope[]> {
    return (await this.properties.resolveMany(tenantId, rentableAssetIds)).map((target) => ({
      rentableAssetId: target.propertyId,
      conflictScopeIds: target.conflictScopeIds,
    }));
  }
}

export class RetrievePrivateRentalAvailability {
  constructor(
    private readonly properties: Pick<RetrieveProperty, "execute">,
    private readonly availability: Pick<CheckRentalAvailability, "execute">,
    private readonly clock: Readonly<{ now(): string }>,
  ) {}

  async execute(input: Readonly<{
    authority: PropertyAuthority;
    propertyId: string;
    startsAt: string;
    endsAt: string;
  }>): Promise<RentalAvailabilityResponseModel> {
    const property = await this.properties.execute({ authority: input.authority, propertyId: input.propertyId });
    const evaluatedAt = this.clock.now();
    return toResponse(property.propertyId, requireRentalMode(property.transactionType), await this.availability.execute({
      tenantId: property.tenantId,
      rentableAssetId: property.propertyId,
      rentalMode: requireRentalMode(property.transactionType),
      requestedInterval: { startsAt: input.startsAt, endsAt: input.endsAt },
      evaluatedAt,
    }), evaluatedAt, true);
  }
}

export class RetrievePublicRentalAvailability {
  constructor(
    private readonly properties: Pick<RetrievePublicProperty, "execute">,
    private readonly availability: Pick<CheckRentalAvailability, "execute">,
    private readonly clock: Readonly<{ now(): string }>,
  ) {}

  async execute(input: Readonly<{
    tenantId: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
  }>): Promise<RentalAvailabilityResponseModel> {
    const property = await this.properties.execute({ tenantId: input.tenantId, publicPropertyId: input.propertyId });
    const mode = requireRentalMode(property.transactionType);
    const evaluatedAt = this.clock.now();
    return toResponse(property.publicPropertyId, mode, await this.availability.execute({
      tenantId: input.tenantId,
      rentableAssetId: property.publicPropertyId,
      rentalMode: mode,
      requestedInterval: { startsAt: input.startsAt, endsAt: input.endsAt },
      evaluatedAt,
    }), evaluatedAt, false);
  }
}

export class ListRentablePublicProperties {
  constructor(
    private readonly properties: Pick<ListPublicProperties, "execute">,
    private readonly availability: Pick<GetCatalogRentalAvailability, "execute">,
    private readonly clock: Readonly<{ now(): string }>,
  ) {}

  async execute(input: Parameters<ListPublicProperties["execute"]>[0]): Promise<PublicPropertyCatalogPage> {
    const page = await this.properties.execute(input);
    const rentals = page.items.filter((item) => item.transactionType !== "SALE");
    const dispositions = await this.availability.execute({
      tenantId: input.tenantId,
      properties: rentals.map((item) => ({
        rentableAssetId: item.publicPropertyId,
        rentalMode: requireRentalMode(item.transactionType),
      })),
      evaluatedAt: this.clock.now(),
    });
    const byProperty = new Map(dispositions.map((item) => [item.rentableAssetId, item]));
    return {
      items: page.items.filter((item) => item.transactionType === "SALE"
        || byProperty.get(item.publicPropertyId)?.catalogDisposition === "AVAILABLE_FOR_INTERVAL"),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    };
  }
}

function requireRentalMode(value: string): RentalOperationMode {
  if (value === "LONG_TERM_RENTAL" || value === "SHORT_TERM_RENTAL") return value;
  throw new RentalAvailabilityNotApplicableError();
}

function toResponse(
  propertyId: string,
  rentalMode: RentalOperationMode,
  decision: AvailabilityDecision,
  evaluatedAt: string,
  includeConflictTypes: boolean,
): RentalAvailabilityResponseModel {
  const conflictTypes = [...new Set(decision.conflicts.map((conflict) => conflict.kind))];
  return {
    propertyId,
    rentalMode,
    availabilityStatus: decision.available ? "AVAILABLE" : "UNAVAILABLE",
    rentableNow: decision.catalogDisposition !== "REMOVE_FROM_RENTAL_CATALOG",
    requestedPeriod: decision.requestedInterval,
    requestedPeriodAvailable: decision.available,
    ...(decision.nextAvailableAt === undefined ? {} : { nextAvailability: decision.nextAvailableAt }),
    evaluatedAt,
    catalogDisposition: decision.catalogDisposition,
    ...(includeConflictTypes && conflictTypes.length > 0 ? { conflictTypes } : {}),
  };
}

export class RentalAvailabilityNotApplicableError extends Error {
  readonly code = "RENTAL_AVAILABILITY_NOT_APPLICABLE";
}

export type PublicRentalProperty = PublicPropertyCatalogDetail;
export type PublicCatalogDisposition = CatalogRentalAvailabilityDisposition;
