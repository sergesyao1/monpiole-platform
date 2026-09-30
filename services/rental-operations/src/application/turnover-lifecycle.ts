import type { RentalOperationsAuthority } from "./operational-lifecycle.js";
import { RentalOperationsForbiddenError } from "./operational-lifecycle.js";
import type { RentableTargetConflictScopeResolver } from "./temporal-availability.js";
import { RentableTargetNotFoundError } from "./temporal-availability.js";

export interface TurnoverSnapshot {
  readonly occupancyId: string;
  readonly stayId: string;
  readonly bookingId: string;
  readonly rentableAssetId: string;
  readonly checkedOutAt: string;
  readonly cleaningBlockId: string;
  readonly cleaningStartsAt: string;
  readonly cleaningEndsAt: string;
  readonly cleaningStatus: "ACTIVE" | "RELEASED";
  readonly cleaningCompletedAt?: string;
  readonly cleaningCompletedByActorId?: string;
}

export interface TurnoverRepository {
  checkout(input: Readonly<{ tenantId: string; actorId: string; occupancyId: string; operationalBlockId: string; allocationId: string; checkedOutAt: string; expectedCleaningCompletionAt: string; conflictScopeIds: readonly string[] }>): Promise<TurnoverSnapshot>;
  completeCleaning(input: Readonly<{ tenantId: string; actorId: string; operationalBlockId: string; completedAt: string }>): Promise<TurnoverSnapshot>;
  extendCleaning(input: Readonly<{ tenantId: string; actorId: string; operationalBlockId: string; newEndAt: string; occurredAt: string }>): Promise<TurnoverSnapshot>;
}

export class CheckoutShortTermStay {
  constructor(private readonly repository: TurnoverRepository, private readonly targets: RentableTargetConflictScopeResolver) {}

  async execute(command: Readonly<{ authority: RentalOperationsAuthority; occupancyId: string; rentableAssetId: string; operationalBlockId: string; allocationId: string; checkedOutAt: string; expectedCleaningCompletionAt: string }>): Promise<TurnoverSnapshot> {
    const tenantId = authorizedTenant(command.authority);
    const target = await this.targets.resolve(tenantId, command.rentableAssetId);
    if (target === undefined || target.conflictScopeIds.length === 0) throw new RentableTargetNotFoundError();
    return this.repository.checkout({ ...command, tenantId, actorId: command.authority.actorId, conflictScopeIds: target.conflictScopeIds });
  }
}

export class CompleteCleaningTurnover {
  constructor(private readonly repository: TurnoverRepository) {}

  execute(command: Readonly<{ authority: RentalOperationsAuthority; operationalBlockId: string; completedAt: string }>): Promise<TurnoverSnapshot> {
    return this.repository.completeCleaning({ ...command, tenantId: authorizedTenant(command.authority), actorId: command.authority.actorId });
  }
}

export class ExtendCleaningTurnover {
  constructor(private readonly repository: TurnoverRepository) {}
  execute(command: Readonly<{ authority: RentalOperationsAuthority; operationalBlockId: string; newEndAt: string; occurredAt: string }>): Promise<TurnoverSnapshot> {
    return this.repository.extendCleaning({ ...command, tenantId: authorizedTenant(command.authority), actorId: command.authority.actorId });
  }
}

function authorizedTenant(authority: RentalOperationsAuthority): string {
  if (!authority.grants.includes("MANAGE_RENTAL_OPERATIONS") || authority.tenantIds.length !== 1) throw new RentalOperationsForbiddenError();
  return authority.tenantIds[0]!;
}
