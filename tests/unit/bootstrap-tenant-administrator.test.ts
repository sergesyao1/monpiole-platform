import { describe, expect, it } from "vitest";
import {
  BootstrapAdministratorConflictError,
  BootstrapTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
  TenantNotFoundError,
} from "../../services/identity/src/index.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMINISTRATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function command(email = " Admin@Example.com ") {
  return { tenantId: TENANT_ID, email, firstName: " Alice ", lastName: " Admin ", correlationId: CORRELATION_ID };
}

function fixture(tenantExists = true) {
  const store = new InMemoryBootstrapAdministratorStore();
  const useCase = new BootstrapTenantAdministrator(
    { exists: async () => tenantExists }, store, { generate: () => ADMINISTRATOR_ID },
  );
  return { store, useCase };
}

describe("Bootstrap Tenant Administrator", () => {
  it("bootstraps the administrator for an existing tenant with normalized values", async () => {
    const { store, useCase } = fixture();
    await expect(useCase.execute(command())).resolves.toEqual({
      tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID,
      email: "admin@example.com", role: "TENANT_ADMINISTRATOR", status: "PENDING_ACTIVATION",
    });
    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("rejects an unknown tenant without persistence", async () => {
    const { store, useCase } = fixture(false);
    await expect(useCase.execute(command())).rejects.toBeInstanceOf(TenantNotFoundError);
    expect(store.identityCount()).toBe(0);
    expect(store.membershipCount()).toBe(0);
  });

  it("rejects a duplicate normalized administrator email", async () => {
    const { store, useCase } = fixture();
    await useCase.execute(command());
    await expect(useCase.execute(command(" ADMIN@example.COM ")))
      .rejects.toBeInstanceOf(BootstrapAdministratorConflictError);
    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("does not create another membership for a tenant with a bootstrap administrator", async () => {
    const { store, useCase } = fixture();
    await useCase.execute(command());
    await expect(useCase.execute(command("other@example.com")))
      .rejects.toBeInstanceOf(BootstrapAdministratorConflictError);
    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });
});
