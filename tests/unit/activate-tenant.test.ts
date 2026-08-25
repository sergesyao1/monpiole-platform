import { describe, expect, it } from "vitest";
import {
  ActivateTenant, Tenant, TenantAdministratorNotReadyError, TenantNotFoundError,
  type ActivateTenantTransaction, type TenantActivatedRecord,
} from "../../services/tenant-management/src/index.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVATED_AT = "2026-08-25T14:00:00.000Z";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function pendingTenant() {
  return Tenant.create({
    id: TENANT_ID, organizationName: "Agency", responsiblePersonName: "Ada Example",
    responsibleEmail: "ada@example.invalid", responsibleTelephone: "+2250102030405",
    country: "CI", createdAt: "2026-08-25T12:00:00.000Z",
  });
}

class MemoryTransaction implements ActivateTenantTransaction {
  tenant: Tenant | undefined;
  readonly events: TenantActivatedRecord[] = [];
  constructor(tenant: Tenant | undefined) { this.tenant = tenant; }
  async findTenantForUpdate() { return this.tenant; }
  async updateTenant(tenant: Tenant) { this.tenant = tenant; }
  async recordTenantActivated(event: TenantActivatedRecord) { this.events.push(event); }
}

function useCase(transaction: MemoryTransaction, administratorReady = true) {
  return new ActivateTenant(
    { execute: async (_tenantId, operation) => operation(transaction) },
    { hasActiveTenantAdministrator: async () => administratorReady },
    { generate: () => EVENT_ID }, { now: () => ACTIVATED_AT },
  );
}

describe("Activate Tenant", () => {
  it("transitions PENDING to ACTIVE through domain behavior", () => {
    const active = pendingTenant().activate(ACTIVATED_AT);
    expect(active.lifecycleState).toBe("ACTIVE");
    expect(active.activatedAt).toBe(ACTIVATED_AT);
  });

  it("keeps ACTIVE activation idempotent", () => {
    const active = pendingTenant().activate(ACTIVATED_AT);
    expect(active.activate("2026-08-25T15:00:00.000Z")).toBe(active);
  });

  it("activates with an active administrator and records one event", async () => {
    const transaction = new MemoryTransaction(pendingTenant());
    await expect(useCase(transaction).execute({ tenantId: TENANT_ID, correlationId: "correlation-1" }))
      .resolves.toEqual({ tenantId: TENANT_ID, lifecycleState: "ACTIVE", activatedAt: ACTIVATED_AT });
    expect(transaction.tenant?.lifecycleState).toBe("ACTIVE");
    expect(transaction.events).toHaveLength(1);
  });

  it("rejects a missing tenant", async () => {
    await expect(useCase(new MemoryTransaction(undefined)).execute({ tenantId: TENANT_ID, correlationId: "c" }))
      .rejects.toBeInstanceOf(TenantNotFoundError);
  });

  it("rejects administrator-not-ready without mutation or event", async () => {
    const transaction = new MemoryTransaction(pendingTenant());
    await expect(useCase(transaction, false).execute({ tenantId: TENANT_ID, correlationId: "c" }))
      .rejects.toBeInstanceOf(TenantAdministratorNotReadyError);
    expect(transaction.tenant?.lifecycleState).toBe("PENDING");
    expect(transaction.events).toHaveLength(0);
  });

  it("verifies readiness and returns an already ACTIVE tenant without another event", async () => {
    const transaction = new MemoryTransaction(pendingTenant().activate(ACTIVATED_AT));
    let readinessQueries = 0;
    const activate = new ActivateTenant(
      { execute: async (_tenantId, operation) => operation(transaction) },
      { hasActiveTenantAdministrator: async () => { readinessQueries += 1; return true; } },
      { generate: () => EVENT_ID }, { now: () => "2026-08-25T15:00:00.000Z" },
    );
    await expect(activate.execute({ tenantId: TENANT_ID, correlationId: "c" }))
      .resolves.toEqual({ tenantId: TENANT_ID, lifecycleState: "ACTIVE", activatedAt: ACTIVATED_AT });
    expect(readinessQueries).toBe(1);
    expect(transaction.events).toHaveLength(0);
  });
});
