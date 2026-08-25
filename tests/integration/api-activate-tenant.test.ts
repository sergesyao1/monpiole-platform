import { afterEach, describe, expect, it } from "vitest";
import {
  ActivateTenantAdministrator, BootstrapTenantAdministrator, HasActiveTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
} from "../../services/identity/src/index.js";
import {
  ActivateTenant, Tenant, type ActivateTenantTransaction, type TenantActivatedRecord,
} from "../../services/tenant-management/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { IdentityActiveTenantAdministratorAdapter } from "../../apps/api/src/composition/identity-active-tenant-administrator.adapter.js";
import { ActivateTenantResponseSchema } from "../../apps/api/src/contracts/v1/tenants/activate-tenant.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UNKNOWN_TENANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ADMINISTRATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTIVATED_AT = "2026-08-25T14:00:00.000Z";

class MemoryTenantTransaction implements ActivateTenantTransaction {
  readonly events: TenantActivatedRecord[] = [];
  constructor(readonly tenants: Map<string, Tenant>) {}
  async findTenantForUpdate(tenantId: string) { return this.tenants.get(tenantId); }
  async updateTenant(tenant: Tenant) { this.tenants.set(tenant.values.id, tenant); }
  async recordTenantActivated(event: TenantActivatedRecord) { this.events.push(event); }
}

describe("Activate Tenant HTTP adapter", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl: string;
  let bootstrap: BootstrapTenantAdministrator;
  let activateAdministrator: ActivateTenantAdministrator;
  let transaction: MemoryTenantTransaction;

  async function start() {
    const identityStore = new InMemoryBootstrapAdministratorStore();
    bootstrap = new BootstrapTenantAdministrator(
      { exists: async (tenantId) => tenantId === TENANT_ID }, identityStore,
      { generate: () => ADMINISTRATOR_ID },
    );
    activateAdministrator = new ActivateTenantAdministrator(identityStore);
    transaction = new MemoryTenantTransaction(new Map([[TENANT_ID, Tenant.create({
      id: TENANT_ID, organizationName: "Agency", responsiblePersonName: "Ada",
      responsibleEmail: "ada@example.invalid", responsibleTelephone: "+2250102030405",
      country: "CI", createdAt: "2026-08-25T12:00:00.000Z",
    })]]));
    const activateTenant = new ActivateTenant(
      { execute: async (_tenantId, operation) => operation(transaction) },
      new IdentityActiveTenantAdministratorAdapter(new HasActiveTenantAdministrator(identityStore)),
      { generate: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }, { now: () => ACTIVATED_AT },
    );
    application = await createApiApplication({ logger: false }, {
      bootstrapTenantAdministrator: bootstrap,
      activateTenantAdministrator: activateAdministrator,
      activateTenant,
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; });

  async function readyAdministrator() {
    await bootstrap.execute({
      tenantId: TENANT_ID, email: "Admin@Example.com", firstName: "Alice", lastName: "Admin", correlationId: "c-1",
    });
    await activateAdministrator.execute({
      tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID, correlationId: "c-2",
    });
  }

  function activate(tenantId: string, correlationId?: string) {
    return fetch(`${baseUrl}/api/v1/tenants/${tenantId}/activate`, {
      method: "POST", headers: correlationId === undefined ? {} : { "x-correlation-id": correlationId },
    });
  }

  it("activates a tenant after its administrator is ACTIVE", async () => {
    await start(); await readyAdministrator();
    const correlationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const response = await activate(TENANT_ID, correlationId);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(ActivateTenantResponseSchema.parse(await response.json())).toEqual({
      tenantId: TENANT_ID, lifecycleState: "ACTIVE", activatedAt: ACTIVATED_AT,
    });
    expect(transaction.events).toHaveLength(1);
  });

  it("returns 200 ACTIVE without a duplicate event for repeated activation", async () => {
    await start(); await readyAdministrator();
    expect((await activate(TENANT_ID)).status).toBe(200);
    const replay = await activate(TENANT_ID);
    expect(replay.status).toBe(200);
    expect((await replay.json() as { activatedAt: string }).activatedAt).toBe(ACTIVATED_AT);
    expect(transaction.events).toHaveLength(1);
  });

  it("returns 400 for an invalid tenant UUID", async () => {
    await start(); const response = await activate("tenant_demo");
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("returns 404 for an unknown tenant", async () => {
    await start(); const response = await activate(UNKNOWN_TENANT_ID);
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("TENANT_NOT_FOUND");
  });

  it("returns safe 409 while the tenant administrator is not ACTIVE", async () => {
    await start();
    await bootstrap.execute({
      tenantId: TENANT_ID, email: "admin@example.com", firstName: "Alice", lastName: "Admin", correlationId: "c",
    });
    const response = await activate(TENANT_ID);
    expect(response.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("TENANT_ADMINISTRATOR_NOT_READY");
    expect(transaction.tenants.get(TENANT_ID)?.lifecycleState).toBe("PENDING");
    expect(transaction.events).toHaveLength(0);
  });
});
