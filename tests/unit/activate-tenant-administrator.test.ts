import { describe, expect, it } from "vitest";
import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  HasActiveTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
  TenantAdministratorNotFoundError,
  IdentityOnboardingForbiddenError,
} from "../../services/identity/src/index.js";
import { Identity } from "../../services/identity/src/domain/identity.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TENANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ADMINISTRATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHORITY = { actorId: "actor-1", authorityId: "authority-1", grants: ["ACTIVATE_TENANT_ADMINISTRATOR", "BOOTSTRAP_TENANT_ADMINISTRATOR"] as const, tenantIds: [TENANT_ID] };
const AUTHORIZER = { authorize: async () => true };

function pendingIdentity() {
  return Identity.bootstrap({
    id: ADMINISTRATOR_ID, email: "admin@example.com", firstName: "Alice", lastName: "Admin",
  });
}

async function fixture() {
  const store = new InMemoryBootstrapAdministratorStore();
  const bootstrap = new BootstrapTenantAdministrator(
    { exists: async () => true }, store, { generate: () => ADMINISTRATOR_ID }, AUTHORIZER,
  );
  await bootstrap.execute({
    tenantId: TENANT_ID, email: "admin@example.com", firstName: "Alice", lastName: "Admin",
    correlationId: CORRELATION_ID, authority: AUTHORITY,
  });
  return { store, activate: new ActivateTenantAdministrator(store, AUTHORIZER) };
}

describe("Activate Tenant Administrator", () => {
  it("changes a PENDING_ACTIVATION identity to ACTIVE through Domain behavior", () => {
    const pending = pendingIdentity();
    expect(pending.status).toBe("PENDING_ACTIVATION");
    expect(pending.activate().status).toBe("ACTIVE");
  });

  it("keeps activation idempotent in the Domain", () => {
    const active = pendingIdentity().activate();
    expect(active.activate()).toBe(active);
    expect(active.status).toBe("ACTIVE");
  });

  it("activates the administrator belonging to the requested tenant and persists ACTIVE", async () => {
    const { store, activate } = await fixture();
    await expect(activate.execute({ tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID, correlationId: CORRELATION_ID, authority: AUTHORITY }))
      .resolves.toEqual({
        tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID, email: "admin@example.com",
        role: "TENANT_ADMINISTRATOR", status: "ACTIVE",
      });
    expect((await store.findIdentityById(ADMINISTRATOR_ID, TENANT_ID))?.status).toBe("ACTIVE");
  });

  it("rejects an unknown administrator with not-found semantics", async () => {
    const { activate } = await fixture();
    await expect(activate.execute({
      tenantId: TENANT_ID, administratorId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", correlationId: CORRELATION_ID, authority: AUTHORITY,
    })).rejects.toBeInstanceOf(TenantAdministratorNotFoundError);
  });

  it("rejects authority before any Identity persistence access", async () => {
    const store = new InMemoryBootstrapAdministratorStore();
    const activate = new ActivateTenantAdministrator(store, { authorize: async () => false });
    await expect(activate.execute({
      tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID,
      correlationId: CORRELATION_ID, authority: AUTHORITY,
    })).rejects.toBeInstanceOf(IdentityOnboardingForbiddenError);
    expect(store.identityCount()).toBe(0);
    expect(store.membershipCount()).toBe(0);
  });

  it("rejects a tenant/administrator mismatch without leaking identity existence", async () => {
    const { activate } = await fixture();
    await expect(activate.execute({
      tenantId: OTHER_TENANT_ID, administratorId: ADMINISTRATOR_ID, correlationId: CORRELATION_ID, authority: AUTHORITY,
    })).rejects.toBeInstanceOf(TenantAdministratorNotFoundError);
  });

  it("reports readiness only after the tenant administrator is ACTIVE", async () => {
    const { store, activate } = await fixture();
    const query = new HasActiveTenantAdministrator(store);
    await expect(query.execute(TENANT_ID)).resolves.toBe(false);
    await activate.execute({ tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID, correlationId: CORRELATION_ID, authority: AUTHORITY });
    await expect(query.execute(TENANT_ID)).resolves.toBe(true);
    await expect(query.execute(OTHER_TENANT_ID)).resolves.toBe(false);
  });
});
