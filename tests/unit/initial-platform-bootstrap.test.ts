import { describe, expect, it, vi } from "vitest";

import {
  InitialPlatformBootstrap,
  PlatformAlreadyInitializedError,
  type InitialPlatformBootstrapDependencies,
} from "../../apps/api/src/operations/initial-platform-bootstrap.js";

const configuration = {
  operatorId: "operator", idempotencyKey: "key", organizationName: "Organization",
  responsiblePersonName: "Operator", responsibleEmail: "operator@example.invalid",
  responsibleTelephone: "+2250102030405", country: "CI",
  administratorEmail: "admin@example.invalid", administratorFirstName: "Alice", administratorLastName: "Admin",
};
const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const identityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function dependencies(overrides: Partial<InitialPlatformBootstrapDependencies> = {}): InitialPlatformBootstrapDependencies {
  return {
    lock: { execute: async (operation) => operation() },
    tenantState: { hasAnyTenant: vi.fn().mockResolvedValue(false) },
    identityState: { hasAnyIdentityOrMembership: vi.fn().mockResolvedValue(false) },
    createTenant: { execute: vi.fn().mockResolvedValue({ tenantId, lifecycleState: "PENDING", createdAt: "2026-08-26T00:00:00Z" }) },
    bootstrapAdministrator: { execute: vi.fn().mockResolvedValue({ tenantId, administratorId: identityId, email: configuration.administratorEmail, role: "TENANT_ADMINISTRATOR", status: "PENDING_ACTIVATION" }) },
    activateAdministrator: { execute: vi.fn().mockResolvedValue({ tenantId, administratorId: identityId, email: configuration.administratorEmail, role: "TENANT_ADMINISTRATOR", status: "ACTIVE" }) },
    activateTenant: { execute: vi.fn().mockResolvedValue({ tenantId, lifecycleState: "ACTIVE", activatedAt: "2026-08-26T00:00:01Z" }) },
    correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    expectedTenantId: tenantId,
    expectedIdentityId: identityId,
    ...overrides,
  };
}

describe("initial platform bootstrap", () => {
  it("runs the approved use cases in order and returns only the durable identifiers and states", async () => {
    const deps = dependencies();
    await expect(new InitialPlatformBootstrap(deps).execute(configuration)).resolves.toEqual({
      tenantId, tenantLifecycleState: "ACTIVE", internalIdentityId: identityId,
      identityStatus: "ACTIVE", role: "TENANT_ADMINISTRATOR",
    });
    const calls = [deps.createTenant, deps.bootstrapAdministrator, deps.activateAdministrator, deps.activateTenant]
      .map((useCase) => vi.mocked(useCase.execute).mock.invocationCallOrder[0]);
    expect(calls).toEqual([...calls].sort((left, right) => left! - right!));
  });

  it.each([[true, false], [false, true], [true, true]])(
    "refuses before side effects when initialized state is tenant=%s identity=%s",
    async (tenantInitialized, identityInitialized) => {
      const deps = dependencies({
        tenantState: { hasAnyTenant: vi.fn().mockResolvedValue(tenantInitialized) },
        identityState: { hasAnyIdentityOrMembership: vi.fn().mockResolvedValue(identityInitialized) },
      });
      await expect(new InitialPlatformBootstrap(deps).execute(configuration)).rejects.toBeInstanceOf(PlatformAlreadyInitializedError);
      expect(deps.createTenant.execute).not.toHaveBeenCalled();
    },
  );

  it("stops immediately after a failed use case", async () => {
    const deps = dependencies({ createTenant: { execute: vi.fn().mockRejectedValue(new Error("failure")) } });
    await expect(new InitialPlatformBootstrap(deps).execute(configuration)).rejects.toThrow("failure");
    expect(deps.bootstrapAdministrator.execute).not.toHaveBeenCalled();
    expect(deps.activateAdministrator.execute).not.toHaveBeenCalled();
    expect(deps.activateTenant.execute).not.toHaveBeenCalled();
  });
});
