import {
  BootstrapAdministratorConflictError,
  type BootstrapAdministratorReplay,
  type BootstrapAdministratorStore,
} from "../application/bootstrap-tenant-administrator.js";
import type { Identity, TenantMembership } from "../domain/identity.js";
import type { ActivateTenantAdministratorStore } from "../application/activate-tenant-administrator.js";
import type { ActiveTenantAdministratorStore } from "../application/has-active-tenant-administrator.js";

export class InMemoryBootstrapAdministratorStore implements
BootstrapAdministratorStore, ActivateTenantAdministratorStore, ActiveTenantAdministratorStore {
  readonly #identitiesByEmail = new Map<string, Identity>();
  readonly #identitiesById = new Map<string, Identity>();
  readonly #membershipsByTenant = new Map<string, TenantMembership>();
  readonly #correlationsByIdentity = new Map<string, string>();

  async findBootstrapByCorrelation(
    correlationId: string,
    tenantId: string,
  ): Promise<BootstrapAdministratorReplay | undefined> {
    const membership = this.#membershipsByTenant.get(tenantId);

    if (membership === undefined) return undefined;

    if (this.#correlationsByIdentity.get(membership.identityId) !== correlationId) {
      return undefined;
    }

    const identity = this.#identitiesById.get(membership.identityId);

    if (identity === undefined) return undefined;

    return { identity, membership };
  }

  async findIdentityByEmail(email: string, _tenantId: string) {
    return this.#identitiesByEmail.get(email);
  }

  async findIdentityById(administratorId: string, tenantId: string) {
    const membership = this.#membershipsByTenant.get(tenantId);
    return membership?.identityId === administratorId
      ? this.#identitiesById.get(administratorId)
      : undefined;
  }

  async findMembership(tenantId: string) {
    return this.#membershipsByTenant.get(tenantId);
  }

  async saveAtomically(
    identity: Identity,
    membership: TenantMembership,
    correlationId: string,
  ): Promise<void> {
    if (
      this.#identitiesByEmail.has(identity.email) ||
      this.#membershipsByTenant.has(membership.tenantId)
    ) {
      throw new BootstrapAdministratorConflictError();
    }

    this.#identitiesByEmail.set(identity.email, identity);
    this.#identitiesById.set(identity.id, identity);
    this.#membershipsByTenant.set(membership.tenantId, membership);
    this.#correlationsByIdentity.set(identity.id, correlationId);
  }

  async saveActivatedIdentity(
    identity: Identity,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    if (this.#membershipsByTenant.get(tenantId)?.identityId !== identity.id) {
      return;
    }

    this.#identitiesById.set(identity.id, identity);
    this.#identitiesByEmail.set(identity.email, identity);
  }

  identityCount() {
    return this.#identitiesByEmail.size;
  }

  membershipCount() {
    return this.#membershipsByTenant.size;
  }
}