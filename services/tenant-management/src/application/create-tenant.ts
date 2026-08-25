import { InvalidTenantInputError, Tenant, normalizeTenantIntent, type NormalizedTenantIntent } from "../domain/tenant.js";

export interface PlatformAuthority {
  readonly actorId: string;
  readonly authorityId: string;
}

export interface CreateTenantCommand extends NormalizedTenantIntent {
  readonly authority: PlatformAuthority;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export interface CreateTenantResult {
  readonly tenantId: string;
  readonly lifecycleState: "PENDING";
  readonly createdAt: string;
}

export interface TenantCreatedRecord {
  readonly eventId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly lifecycleState: "PENDING";
}

export interface IdempotencyRecord {
  readonly authorityId: string;
  readonly idempotencyKey: string;
  readonly normalizedIntent: string;
  readonly result: CreateTenantResult;
  readonly correlationId: string;
  readonly actorId: string;
}

export interface CreateTenantTransaction {
  acquireIdempotencyKey(authorityId: string, idempotencyKey: string): Promise<void>;
  findIdempotency(authorityId: string, idempotencyKey: string): Promise<IdempotencyRecord | undefined>;
  findByResponsibleEmail(email: string): Promise<Tenant | undefined>;
  insertTenant(tenant: Tenant, trace: { correlationId: string; actorId: string; authorityId: string }): Promise<void>;
  insertIdempotency(record: IdempotencyRecord): Promise<void>;
  recordTenantCreated(event: TenantCreatedRecord): Promise<void>;
}

export interface CreateTenantUnitOfWork {
  execute<Result>(operation: (transaction: CreateTenantTransaction) => Promise<Result>): Promise<Result>;
}

export interface PlatformAuthorityAuthorizer {
  authorizeCreateTenant(authority: PlatformAuthority): Promise<boolean>;
}

export interface IdentifierGenerator { generate(): string; }
export interface Clock { now(): string; }

export class CreateTenantForbiddenError extends Error { readonly code = "CREATE_TENANT_FORBIDDEN"; }
export class DuplicateTenantEmailError extends Error { readonly code = "DUPLICATE_TENANT_EMAIL"; }
export class IdempotencyConflictError extends Error { readonly code = "CREATE_TENANT_IDEMPOTENCY_CONFLICT"; }
export class IdempotencyWriteConflictError extends Error { readonly code = "CREATE_TENANT_IDEMPOTENCY_WRITE_CONFLICT"; }

export function deterministicTenantIntent(intent: NormalizedTenantIntent): string {
  return JSON.stringify([
    intent.organizationName,
    intent.responsiblePersonName,
    intent.responsibleEmail,
    intent.responsibleTelephone,
    intent.country,
  ]);
}

export class CreateTenant {
  constructor(
    private readonly authorizer: PlatformAuthorityAuthorizer,
    private readonly unitOfWork: CreateTenantUnitOfWork,
    private readonly tenantIds: IdentifierGenerator,
    private readonly eventIds: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateTenantCommand): Promise<CreateTenantResult> {
    if (!await this.authorizer.authorizeCreateTenant(command.authority)) {
      throw new CreateTenantForbiddenError();
    }
    const normalized = normalizeTenantIntent(command);
    const normalizedIntent = deterministicTenantIntent(normalized);
    try {
      return await this.attempt(command, normalized, normalizedIntent);
    } catch (error) {
      if (!(error instanceof IdempotencyWriteConflictError)) throw error;
      return this.unitOfWork.execute(async (transaction) => {
        const existing = await transaction.findIdempotency(command.authority.authorityId, command.idempotencyKey);
        if (existing === undefined || existing.normalizedIntent !== normalizedIntent) {
          throw new IdempotencyConflictError();
        }
        return existing.result;
      });
    }
  }

  private attempt(
    command: CreateTenantCommand,
    normalized: NormalizedTenantIntent,
    normalizedIntent: string,
  ): Promise<CreateTenantResult> {
    return this.unitOfWork.execute(async (transaction) => {
      await transaction.acquireIdempotencyKey(command.authority.authorityId, command.idempotencyKey);
      const existing = await transaction.findIdempotency(command.authority.authorityId, command.idempotencyKey);
      if (existing !== undefined) {
        if (existing.normalizedIntent !== normalizedIntent) throw new IdempotencyConflictError();
        return existing.result;
      }
      if (await transaction.findByResponsibleEmail(normalized.responsibleEmail)) {
        throw new DuplicateTenantEmailError();
      }
      const createdAt = this.clock.now();
      const tenant = Tenant.create({ id: this.tenantIds.generate(), ...normalized, createdAt });
      const result = Object.freeze({ tenantId: tenant.values.id, lifecycleState: tenant.lifecycleState, createdAt });
      const trace = { correlationId: command.correlationId, actorId: command.authority.actorId, authorityId: command.authority.authorityId };
      await transaction.insertTenant(tenant, trace);
      await transaction.insertIdempotency({
        authorityId: command.authority.authorityId,
        idempotencyKey: command.idempotencyKey,
        normalizedIntent,
        result,
        correlationId: command.correlationId,
        actorId: command.authority.actorId,
      });
      await transaction.recordTenantCreated({
        eventId: this.eventIds.generate(), tenantId: result.tenantId,
        correlationId: command.correlationId, occurredAt: createdAt,
        lifecycleState: "PENDING",
      });
      return result;
    });
  }
}

export { InvalidTenantInputError };
