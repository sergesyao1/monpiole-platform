import type { Identity, TenantMembership } from "../domain/identity.js";

export interface ActivateTenantAdministratorCommand {
  readonly tenantId: string;
  readonly administratorId: string;
  readonly correlationId: string;
}

export interface ActivateTenantAdministratorResult {
  readonly tenantId: string;
  readonly administratorId: string;
  readonly email: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "ACTIVE";
}

export interface ActivateTenantAdministratorStore {
  findMembership(tenantId: string): Promise<TenantMembership | undefined>;
  findIdentityById(administratorId: string, tenantId: string): Promise<Identity | undefined>;
  saveActivatedIdentity(identity: Identity, tenantId: string, correlationId: string): Promise<void>;
}

export class TenantAdministratorNotFoundError extends Error {
  readonly code = "TENANT_ADMINISTRATOR_NOT_FOUND";
}

export class ActivateTenantAdministrator {
  constructor(private readonly store: ActivateTenantAdministratorStore) {}

  async execute(command: ActivateTenantAdministratorCommand): Promise<ActivateTenantAdministratorResult> {
    const membership = await this.store.findMembership(command.tenantId);
    if (membership === undefined || membership.identityId !== command.administratorId) {
      throw new TenantAdministratorNotFoundError();
    }
    const identity = await this.store.findIdentityById(command.administratorId, command.tenantId);
    if (identity === undefined) throw new TenantAdministratorNotFoundError();
    const activeIdentity = identity.activate();
    await this.store.saveActivatedIdentity(activeIdentity, command.tenantId, command.correlationId);
    return Object.freeze({
      tenantId: membership.tenantId,
      administratorId: activeIdentity.id,
      email: activeIdentity.email,
      role: membership.role,
      status: activeIdentity.status,
    });
  }
}
