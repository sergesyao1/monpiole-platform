import { afterEach, describe, expect, it } from "vitest";
import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
} from "../../services/identity/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ActivateAdministratorResponseSchema } from "../../apps/api/src/contracts/v1/tenants/activate-administrator.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { OnboardingAuthorityPolicy } from "../../apps/api/src/composition/onboarding-authority-policy.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ADMIN_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const AUTHORIZER = new OnboardingAuthorityPolicy();

describe("Activate Tenant Administrator HTTP adapter", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl: string;
  let authentication: "authorized" | "unauthorized" | "missing" = "authorized";
  let authorityTenantIds = [TENANT_A, TENANT_B];

  async function start() {
    const store = new InMemoryBootstrapAdministratorStore();
    const identifiers = [ADMIN_A, ADMIN_B];
    const bootstrap = new BootstrapTenantAdministrator(
      { exists: async () => true }, store, { generate: () => identifiers.shift() ?? ADMIN_B }, AUTHORIZER,
    );
    const activate = new ActivateTenantAdministrator(store, AUTHORIZER);
    application = await createApiApplication({ logger: false }, {
      bootstrapTenantAdministrator: bootstrap,
      activateTenantAdministrator: activate,
      authenticatedAuthorityProvider: { resolve: async () => authentication === "missing" ? undefined : ({
        actorId: "actor-1", authorityId: "authority-1",
        grants: authentication === "authorized"
          ? ["BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR"]
          : ["BOOTSTRAP_TENANT_ADMINISTRATOR"],
        tenantIds: authorityTenantIds,
      }) },
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => {
    await application?.close(); application = undefined; authentication = "authorized";
    authorityTenantIds = [TENANT_A, TENANT_B];
  });

  function bootstrap(tenantId: string, email: string) {
    return fetch(`${baseUrl}/v1/tenants/${tenantId}/administrators/bootstrap`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, firstName: "Alice", lastName: "Admin" }),
    });
  }

  function activate(tenantId: string, administratorId: string, correlationId?: string) {
    return fetch(`${baseUrl}/v1/tenants/${tenantId}/administrators/${administratorId}/activate`, {
      method: "POST", headers: correlationId === undefined ? {} : { "x-correlation-id": correlationId },
    });
  }

  it("bootstraps then activates an administrator with compliant context headers", async () => {
    await start(); expect((await bootstrap(TENANT_A, "Admin@Example.com")).status).toBe(201);
    const correlationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const response = await activate(TENANT_A, ADMIN_A, correlationId);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(ActivateAdministratorResponseSchema.parse(await response.json())).toEqual({
      tenantId: TENANT_A, administratorId: ADMIN_A, email: "admin@example.com",
      role: "TENANT_ADMINISTRATOR", status: "ACTIVE",
    });
  });

  it("returns 200 ACTIVE for repeated activation", async () => {
    await start(); await bootstrap(TENANT_A, "admin@example.com");
    expect((await activate(TENANT_A, ADMIN_A)).status).toBe(200);
    const repeated = await activate(TENANT_A, ADMIN_A);
    expect(repeated.status).toBe(200);
    expect(ActivateAdministratorResponseSchema.parse(await repeated.json()).status).toBe("ACTIVE");
  });

  it.each([
    ["invalid tenantId", "tenant_demo", ADMIN_A],
    ["invalid administratorId", TENANT_A, "administrator_demo"],
  ])("returns 400 for %s", async (_name, tenantId, administratorId) => {
    await start(); const response = await activate(tenantId, administratorId);
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("returns 404 for an unknown administrator", async () => {
    await start(); await bootstrap(TENANT_A, "admin@example.com");
    const response = await activate(TENANT_A, ADMIN_B);
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("TENANT_ADMINISTRATOR_NOT_FOUND");
  });

  it.each([
    ["missing", 401, "UNAUTHORIZED"],
    ["unauthorized", 403, "FORBIDDEN"],
  ] as const)("rejects %s authority without activation", async (state, status, code) => {
    await start(); await bootstrap(TENANT_A, "admin@example.com"); authentication = state;
    const response = await activate(TENANT_A, ADMIN_A);
    expect(response.status).toBe(status);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe(code);
  });

  it("returns 404 when an administrator belongs to another tenant", async () => {
    await start();
    await bootstrap(TENANT_A, "admin-a@example.com");
    await bootstrap(TENANT_B, "admin-b@example.com");
    const response = await activate(TENANT_B, ADMIN_A);
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("TENANT_ADMINISTRATOR_NOT_FOUND");
  });

  it("rejects an authenticated authority scoped to another tenant", async () => {
    await start(); await bootstrap(TENANT_B, "admin-b@example.com");
    authorityTenantIds = [TENANT_A];
    const response = await activate(TENANT_B, ADMIN_A);
    expect(response.status).toBe(403);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("FORBIDDEN");
  });
});
