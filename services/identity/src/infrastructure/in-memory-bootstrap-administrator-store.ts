import {
  BootstrapAdministratorConflictError,
  type BootstrapAdministratorStore,
} from "../application/bootstrap-tenant-administrator.js";
import type { Identity, TenantMembership } from "../domain/identity.js";

export class InMemoryBootstrapAdministratorStore implements BootstrapAdministratorStore {
  readonly #identitiesByEmail = new Map<string, Identity>();
  readonly #membershipsByTenant = new Map<string, TenantMembership>();
  readonly #correlationsByIdentity = new Map<string, string>();

  async findIdentityByEmail(email: string) { return this.#identitiesByEmail.get(email); }
  async findMembership(tenantId: string) { return this.#membershipsByTenant.get(tenantId); }

  async saveAtomically(identity: Identity, membership: TenantMembership, correlationId: string): Promise<void> {
    if (this.#identitiesByEmail.has(identity.email) || this.#membershipsByTenant.has(membership.tenantId)) {
      throw new BootstrapAdministratorConflictError();
    }
    this.#identitiesByEmail.set(identity.email, identity);
    this.#membershipsByTenant.set(membership.tenantId, membership);
    this.#correlationsByIdentity.set(identity.id, correlationId);
  }

  identityCount() { return this.#identitiesByEmail.size; }
  membershipCount() { return this.#membershipsByTenant.size; }
}
