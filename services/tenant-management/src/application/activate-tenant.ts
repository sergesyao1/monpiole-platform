import type { Tenant } from "../domain/tenant.js";
import type { Clock, IdentifierGenerator } from "./create-tenant.js";

export interface ActivateTenantCommand {
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface ActivateTenantResult {
  readonly tenantId: string;
  readonly lifecycleState: "ACTIVE";
  readonly activatedAt: string;
}

export interface TenantActivatedRecord extends ActivateTenantResult {
  readonly eventId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export interface ActivateTenantTransaction {
  findTenantForUpdate(tenantId: string): Promise<Tenant | undefined>;
  updateTenant(tenant: Tenant): Promise<void>;
  recordTenantActivated(event: TenantActivatedRecord): Promise<void>;
}

export interface ActivateTenantUnitOfWork {
  execute<Result>(tenantId: string, operation: (transaction: ActivateTenantTransaction) => Promise<Result>): Promise<Result>;
}

export interface ActiveTenantAdministratorPort {
  hasActiveTenantAdministrator(tenantId: string): Promise<boolean>;
}

export class TenantNotFoundError extends Error { readonly code = "ACTIVATE_TENANT_NOT_FOUND"; }
export class TenantAdministratorNotReadyError extends Error { readonly code = "TENANT_ADMINISTRATOR_NOT_READY"; }

export class ActivateTenant {
  constructor(
    private readonly unitOfWork: ActivateTenantUnitOfWork,
    private readonly activeAdministrator: ActiveTenantAdministratorPort,
    private readonly eventIds: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  execute(command: ActivateTenantCommand): Promise<ActivateTenantResult> {
    return this.unitOfWork.execute(command.tenantId, async (transaction) => {
      const tenant = await transaction.findTenantForUpdate(command.tenantId);
      if (tenant === undefined) throw new TenantNotFoundError();
      if (!await this.activeAdministrator.hasActiveTenantAdministrator(command.tenantId)) {
        throw new TenantAdministratorNotReadyError();
      }
      if (tenant.lifecycleState === "ACTIVE") {
        return Object.freeze({ tenantId: tenant.values.id, lifecycleState: "ACTIVE", activatedAt: tenant.activatedAt! });
      }
      const occurredAt = this.clock.now();
      const activeTenant = tenant.activate(occurredAt);
      await transaction.updateTenant(activeTenant);
      await transaction.recordTenantActivated({
        eventId: this.eventIds.generate(), tenantId: activeTenant.values.id,
        lifecycleState: "ACTIVE", activatedAt: activeTenant.activatedAt!,
        correlationId: command.correlationId, occurredAt,
      });
      return Object.freeze({
        tenantId: activeTenant.values.id, lifecycleState: "ACTIVE", activatedAt: activeTenant.activatedAt!,
      });
    });
  }
}
