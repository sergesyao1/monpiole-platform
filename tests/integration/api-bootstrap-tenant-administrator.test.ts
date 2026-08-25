import { afterEach, describe, expect, it } from "vitest";
import {
  BootstrapTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
} from "../../services/identity/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import {
  BootstrapAdministratorResponseSchema,
} from "../../apps/api/src/contracts/v1/tenants/bootstrap-administrator.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMINISTRATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Bootstrap Tenant Administrator HTTP adapter", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl: string;
  let tenantExists = true;

  async function start() {
    const useCase = new BootstrapTenantAdministrator(
      { exists: async (tenantId) => tenantExists && tenantId === TENANT_ID },
      new InMemoryBootstrapAdministratorStore(),
      { generate: () => ADMINISTRATOR_ID },
    );
    application = await createApiApplication({ logger: false }, { bootstrapTenantAdministrator: useCase });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; tenantExists = true; });

  function request(tenantId = TENANT_ID, body: unknown = {
    email: " Admin@Example.com ", firstName: " Alice ", lastName: " Admin ",
  }) {
    return fetch(`${baseUrl}/v1/tenants/${tenantId}/administrators/bootstrap`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
  }

  it("returns 201 and the canonical pending tenant administrator", async () => {
    await start(); const response = await request();
    expect(response.status).toBe(201);
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(BootstrapAdministratorResponseSchema.parse(await response.json())).toEqual({
      tenantId: TENANT_ID, administratorId: ADMINISTRATOR_ID, email: "admin@example.com",
      role: "TENANT_ADMINISTRATOR", status: "PENDING_ACTIVATION",
    });
  });

  it("returns 404 for an unknown tenant", async () => {
    tenantExists = false; await start(); const response = await request();
    expect(response.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("TENANT_NOT_FOUND");
  });

  it("returns 409 for a duplicate administrator", async () => {
    await start(); expect((await request()).status).toBe(201);
    const response = await request(); expect(response.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("ADMINISTRATOR_CONFLICT");
  });

  it.each([
    ["invalid email", TENANT_ID, { email: "invalid", firstName: "Alice", lastName: "Admin" }],
    ["empty firstName", TENANT_ID, { email: "admin@example.com", firstName: " ", lastName: "Admin" }],
    ["empty lastName", TENANT_ID, { email: "admin@example.com", firstName: "Alice", lastName: " " }],
    ["invalid tenantId", "tenant_demo", { email: "admin@example.com", firstName: "Alice", lastName: "Admin" }],
  ])("returns 400 for %s", async (_name, tenantId, body) => {
    await start(); const response = await request(tenantId, body);
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });
});
