import type { Identity, TenantMembership } from "../domain/identity.js";

export interface ActiveTenantAdministratorStore {
  findMembership(tenantId: string): Promise<TenantMembership | undefined>;
  findIdentityById(administratorId: string): Promise<Identity | undefined>;
}

export class HasActiveTenantAdministrator {
  constructor(private readonly store: ActiveTenantAdministratorStore) {}

  async execute(tenantId: string): Promise<boolean> {
    const membership = await this.store.findMembership(tenantId);
    if (membership === undefined || membership.role !== "TENANT_ADMINISTRATOR") return false;
    const identity = await this.store.findIdentityById(membership.identityId);
    return identity?.status === "ACTIVE";
  }
}
