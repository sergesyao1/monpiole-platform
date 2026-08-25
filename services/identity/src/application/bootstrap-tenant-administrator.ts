import { Identity, TenantMembership, normalizeAdministratorEmail } from "../domain/identity.js";

export interface BootstrapTenantAdministratorCommand {
  readonly tenantId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly correlationId: string;
}

export interface BootstrapTenantAdministratorResult {
  readonly tenantId: string;
  readonly administratorId: string;
  readonly email: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "PENDING_ACTIVATION";
}

export interface TenantExistencePort { exists(tenantId: string): Promise<boolean>; }
export interface IdentityIdentifierGenerator { generate(): string; }
export interface BootstrapAdministratorStore {
  findIdentityByEmail(normalizedEmail: string, tenantId: string): Promise<Identity | undefined>;
  findMembership(tenantId: string): Promise<TenantMembership | undefined>;
  saveAtomically(identity: Identity, membership: TenantMembership, correlationId: string): Promise<void>;
}

export class TenantNotFoundError extends Error { readonly code = "BOOTSTRAP_TENANT_NOT_FOUND"; }
export class BootstrapAdministratorConflictError extends Error { readonly code = "BOOTSTRAP_ADMINISTRATOR_CONFLICT"; }

export class BootstrapTenantAdministrator {
  constructor(
    private readonly tenants: TenantExistencePort,
    private readonly store: BootstrapAdministratorStore,
    private readonly identifiers: IdentityIdentifierGenerator,
  ) {}

  async execute(command: BootstrapTenantAdministratorCommand): Promise<BootstrapTenantAdministratorResult> {
    if (!await this.tenants.exists(command.tenantId)) throw new TenantNotFoundError();
    const email = normalizeAdministratorEmail(command.email);
    if (await this.store.findIdentityByEmail(email, command.tenantId) || await this.store.findMembership(command.tenantId)) {
      throw new BootstrapAdministratorConflictError();
    }
    const identity = Identity.bootstrap({
      id: this.identifiers.generate(), email,
      firstName: command.firstName, lastName: command.lastName,
    });
    const membership = TenantMembership.bootstrap(command.tenantId, identity.id);
    await this.store.saveAtomically(identity, membership, command.correlationId);
    return Object.freeze({
      tenantId: membership.tenantId, administratorId: identity.id, email: identity.email,
      role: membership.role, status: identity.status,
    });
  }
}
