import type {
  RentalAllocation,
  RentalOperationMode,
} from "../domain/rental-operations.js";

export interface RequestedInterval {
  readonly startsAt: string;
  readonly endsAt: string;
}

export type AvailabilityConflict = Readonly<{
  conflictId: string;
  kind: "ALLOCATION" | "OPERATIONAL_BLOCK";
  startsAt: string;
  endsAt?: string;
}>;

export interface AvailabilityQueryPort {
  listActiveConflicts(input: Readonly<{
    tenantId: string;
    conflictScopeIds: readonly string[];
    startsAt: string;
    endsAt?: string;
  }>): Promise<readonly AvailabilityConflict[]>;
  hasEffectiveLongTermOccupancy(input: Readonly<{
    tenantId: string;
    conflictScopeIds: readonly string[];
    at: string;
  }>): Promise<boolean>;
}

export interface CatalogAvailabilityQueryPort {
  listEffectiveLongTermOccupiedScopeIds(input: Readonly<{
    tenantId: string;
    conflictScopeIds: readonly string[];
    at: string;
  }>): Promise<ReadonlySet<string>>;
}

export interface RentalAllocationCommitPort {
  commitIfAvailable(
    allocation: RentalAllocation,
    conflictScopeIds: readonly string[],
  ): Promise<void>;
}

export interface RentableTargetConflictScope {
  readonly rentableAssetId: string;
  readonly conflictScopeIds: readonly string[];
}

export interface RentableTargetConflictScopeResolver {
  resolve(tenantId: string, rentableAssetId: string): Promise<RentableTargetConflictScope | undefined>;
}

export interface BatchRentableTargetConflictScopeResolver {
  resolveMany(tenantId: string, rentableAssetIds: readonly string[]): Promise<readonly RentableTargetConflictScope[]>;
}

export class RentableTargetNotFoundError extends Error {
  readonly code = "RENTABLE_TARGET_NOT_FOUND";
}

export class RentalAllocationConflictError extends Error {
  readonly code = "RENTAL_ALLOCATION_CONFLICT";
}

export interface AvailabilityDecision {
  readonly available: boolean;
  readonly requestedInterval: RequestedInterval;
  readonly conflicts: readonly AvailabilityConflict[];
  readonly nextAvailableAt?: string;
  readonly catalogDisposition: "AVAILABLE_FOR_INTERVAL" | "UNAVAILABLE_FOR_INTERVAL" | "REMOVE_FROM_RENTAL_CATALOG";
}

export interface CatalogRentalAvailabilityDisposition {
  readonly rentableAssetId: string;
  readonly catalogDisposition: "AVAILABLE_FOR_INTERVAL" | "REMOVE_FROM_RENTAL_CATALOG";
}

export class GetCatalogRentalAvailability {
  constructor(
    private readonly queries: CatalogAvailabilityQueryPort,
    private readonly targets: BatchRentableTargetConflictScopeResolver,
  ) {}

  async execute(input: Readonly<{
    tenantId: string;
    properties: readonly Readonly<{ rentableAssetId: string; rentalMode: RentalOperationMode }>[];
    evaluatedAt: string;
  }>): Promise<readonly CatalogRentalAvailabilityDisposition[]> {
    const targets = await this.targets.resolveMany(
      input.tenantId,
      input.properties.map((property) => property.rentableAssetId),
    );
    const byAsset = new Map(targets.map((target) => [target.rentableAssetId, target]));
    const allScopes = [...new Set(targets.flatMap((target) => target.conflictScopeIds))];
    const occupied = allScopes.length === 0
      ? new Set<string>()
      : await this.queries.listEffectiveLongTermOccupiedScopeIds({
        tenantId: input.tenantId,
        conflictScopeIds: allScopes,
        at: input.evaluatedAt,
      });
    return input.properties.flatMap((property) => {
      const target = byAsset.get(property.rentableAssetId);
      if (target === undefined) return [];
      const remove = property.rentalMode === "LONG_TERM_RENTAL"
        && target.conflictScopeIds.some((scopeId) => occupied.has(scopeId));
      return [{
        rentableAssetId: property.rentableAssetId,
        catalogDisposition: remove ? "REMOVE_FROM_RENTAL_CATALOG" : "AVAILABLE_FOR_INTERVAL",
      } satisfies CatalogRentalAvailabilityDisposition];
    });
  }
}

export class CheckRentalAvailability {
  constructor(
    private readonly queries: AvailabilityQueryPort,
    private readonly targets: RentableTargetConflictScopeResolver,
  ) {}

  async execute(input: Readonly<{
    tenantId: string;
    rentableAssetId: string;
    rentalMode: RentalOperationMode;
    requestedInterval: RequestedInterval;
    evaluatedAt: string;
  }>): Promise<AvailabilityDecision> {
    assertBoundedInterval(input.requestedInterval);
    const target = await this.targets.resolve(input.tenantId, input.rentableAssetId);
    if (target === undefined || target.conflictScopeIds.length === 0) {
      throw new RentableTargetNotFoundError();
    }
    const conflicts = await this.queries.listActiveConflicts({
      tenantId: input.tenantId,
      conflictScopeIds: target.conflictScopeIds,
      startsAt: input.requestedInterval.startsAt,
    });
    const overlapping = conflicts.filter((conflict) => intervalsOverlap(
      input.requestedInterval.startsAt,
      input.requestedInterval.endsAt,
      conflict.startsAt,
      conflict.endsAt,
    ));
    const effectiveLongTerm = await this.queries.hasEffectiveLongTermOccupancy({
        tenantId: input.tenantId,
        conflictScopeIds: target.conflictScopeIds,
        at: input.evaluatedAt,
      });
    const nextAvailableAt = findNextAvailableAt(input.requestedInterval, conflicts);
    return {
      available: overlapping.length === 0 && !effectiveLongTerm,
      requestedInterval: input.requestedInterval,
      conflicts: overlapping,
      ...(nextAvailableAt === undefined ? {} : { nextAvailableAt }),
      catalogDisposition: effectiveLongTerm
        ? "REMOVE_FROM_RENTAL_CATALOG"
        : overlapping.length === 0
          ? "AVAILABLE_FOR_INTERVAL"
          : "UNAVAILABLE_FOR_INTERVAL",
    };
  }
}

export class ListRentalAvailabilityConflicts {
  constructor(
    private readonly queries: AvailabilityQueryPort,
    private readonly targets: RentableTargetConflictScopeResolver,
  ) {}

  async execute(input: Readonly<{
    tenantId: string;
    rentableAssetId: string;
    requestedInterval: RequestedInterval;
  }>): Promise<readonly AvailabilityConflict[]> {
    assertBoundedInterval(input.requestedInterval);
    const target = await resolveTarget(this.targets, input.tenantId, input.rentableAssetId);
    return this.queries.listActiveConflicts({
      tenantId: input.tenantId,
      conflictScopeIds: target.conflictScopeIds,
      startsAt: input.requestedInterval.startsAt,
      endsAt: input.requestedInterval.endsAt,
    });
  }
}

export class FindNextRentalAvailability {
  constructor(
    private readonly queries: AvailabilityQueryPort,
    private readonly targets: RentableTargetConflictScopeResolver,
  ) {}

  async execute(input: Readonly<{
    tenantId: string;
    rentableAssetId: string;
    requestedInterval: RequestedInterval;
  }>): Promise<string | undefined> {
    assertBoundedInterval(input.requestedInterval);
    const target = await resolveTarget(this.targets, input.tenantId, input.rentableAssetId);
    const conflicts = await this.queries.listActiveConflicts({
      tenantId: input.tenantId,
      conflictScopeIds: target.conflictScopeIds,
      startsAt: input.requestedInterval.startsAt,
    });
    return findNextAvailableAt(input.requestedInterval, conflicts);
  }
}

export class AssertRentalAvailable {
  constructor(private readonly checker: CheckRentalAvailability) {}

  async execute(input: Parameters<CheckRentalAvailability["execute"]>[0]): Promise<void> {
    if (!(await this.checker.execute(input)).available) throw new RentalAllocationConflictError();
  }
}

export class CommitRentalAllocation {
  constructor(
    private readonly commits: RentalAllocationCommitPort,
    private readonly targets: RentableTargetConflictScopeResolver,
  ) {}

  async execute(allocation: RentalAllocation): Promise<void> {
    const target = await this.targets.resolve(
      allocation.values.tenantId,
      allocation.values.rentableAssetId,
    );
    if (target === undefined || target.conflictScopeIds.length === 0) {
      throw new RentableTargetNotFoundError();
    }
    try {
      await this.commits.commitIfAvailable(allocation, target.conflictScopeIds);
    } catch (error) {
      if (isAllocationConflict(error)) throw new RentalAllocationConflictError();
      throw error;
    }
  }
}

export function intervalsOverlap(
  leftStart: string,
  leftEnd: string | undefined,
  rightStart: string,
  rightEnd: string | undefined,
): boolean {
  return (rightEnd === undefined || Date.parse(leftStart) < Date.parse(rightEnd))
    && (leftEnd === undefined || Date.parse(rightStart) < Date.parse(leftEnd));
}

export function findNextAvailableAt(
  request: RequestedInterval,
  conflicts: readonly AvailabilityConflict[],
): string | undefined {
  assertBoundedInterval(request);
  const duration = Date.parse(request.endsAt) - Date.parse(request.startsAt);
  let candidate = Date.parse(request.startsAt);
  const ordered = [...conflicts].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  for (const conflict of ordered) {
    const conflictStart = Date.parse(conflict.startsAt);
    const conflictEnd = conflict.endsAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(conflict.endsAt);
    if (conflictEnd <= candidate) continue;
    if (candidate + duration <= conflictStart) break;
    candidate = Math.max(candidate, conflictEnd);
    if (!Number.isFinite(candidate)) return undefined;
  }
  return new Date(candidate).toISOString();
}

function assertBoundedInterval(interval: RequestedInterval): void {
  const start = Date.parse(interval.startsAt);
  const end = Date.parse(interval.endsAt);
  if (!interval.startsAt.endsWith("Z") || !interval.endsAt.endsWith("Z")
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError("Invalid requested interval");
  }
}

function isAllocationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "code" in error && error.code === "23P01";
}

async function resolveTarget(
  targets: RentableTargetConflictScopeResolver,
  tenantId: string,
  rentableAssetId: string,
): Promise<RentableTargetConflictScope> {
  const target = await targets.resolve(tenantId, rentableAssetId);
  if (target === undefined || target.conflictScopeIds.length === 0) {
    throw new RentableTargetNotFoundError();
  }
  return target;
}
