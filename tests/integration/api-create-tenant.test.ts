import { afterEach, describe, expect, it } from "vitest";
import {
  CreateTenantForbiddenError,
  DuplicateTenantEmailError,
  IdempotencyConflictError,
  type CreateTenantCommand,
  type CreateTenantResult,
} from "../../services/tenant-management/src/index.js";
import { CreateTenantResponseSchema } from "../../apps/api/src/contracts/v1/tenants/create-tenant.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";

const result: CreateTenantResult = {
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lifecycleState: "PENDING",
  createdAt: "2026-08-25T12:00:00.000Z",
};

describe("Create Tenant HTTP adapter", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl: string;
  let received: CreateTenantCommand | undefined;
  let failure: unknown;

  async function start(authority = true) {
    application = await createApiApplication({ logger: false }, {
      createTenant: { execute: async (command) => { received = command; if (failure) throw failure; return result; } },
      platformAuthorityProvider: { resolve: async () => authority ? { actorId: "actor-1", authorityId: "platform-admin" } : undefined },
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; received = undefined; failure = undefined; });

  function request(headers: Record<string, string> = {}, body: unknown = {
    organizationName: " Agency ", responsiblePersonName: " Ada Example ",
    responsibleEmail: " ADA@EXAMPLE.INVALID ", responsibleTelephone: "+2250102030405", country: "CI",
  }) {
    return fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "create-1", ...headers },
      body: JSON.stringify(body),
    });
  }

  it("returns 201 with a PENDING tenant and maps explicit context", async () => {
    await start();
    const correlationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const response = await request({ "x-correlation-id": correlationId });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(CreateTenantResponseSchema.parse(await response.json())).toEqual({ tenantId: result.tenantId, lifecycleState: "PENDING" });
    expect(received).toMatchObject({
      organizationName: "Agency", responsiblePersonName: "Ada Example", responsibleEmail: "ada@example.invalid",
      correlationId, idempotencyKey: "create-1", authority: { actorId: "actor-1", authorityId: "platform-admin" },
    });
  });

  it.each([
    ["missing idempotency", {}, { "idempotency-key": undefined }],
    ["tenant header not applicable", {}, { "x-tenant-id": "tenant_demo" }],
    ["invalid body", { organizationName: "" }, {}],
  ])("returns 400 for %s", async (_name, bodyChange, headerChange) => {
    await start();
    const headers = Object.fromEntries(Object.entries(headerChange).filter(([, value]) => value !== undefined)) as Record<string, string>;
    const response = _name === "missing idempotency"
      ? await fetch(`${baseUrl}/api/v1/tenants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationName: "Agency", responsiblePersonName: "Ada", responsibleEmail: "ada@example.invalid", responsibleTelephone: "+2250102030405", country: "CI" }) })
      : await request(headers, { organizationName: "Agency", responsiblePersonName: "Ada", responsibleEmail: "ada@example.invalid", responsibleTelephone: "+2250102030405", country: "CI", ...bodyChange });
    expect(response.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("INVALID_REQUEST");
  });

  it("returns 403 when no platform authority is established", async () => {
    await start(false); const response = await request();
    expect(response.status).toBe(403);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("FORBIDDEN");
    expect(received).toBeUndefined();
  });

  it.each([
    [new DuplicateTenantEmailError(), "DUPLICATE_TENANT"],
    [new IdempotencyConflictError(), "IDEMPOTENCY_CONFLICT"],
  ])("maps a business conflict to safe 409", async (error, code) => {
    failure = error; await start(); const response = await request();
    expect(response.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe(code);
  });

  it("retains the existing safe 500 mapping", async () => {
    failure = new Error("database secret detail"); await start(); const response = await request();
    expect(response.status).toBe(500); const raw = await response.text();
    expect(raw).not.toContain("database secret detail");
    expect(ProblemDetailsSchema.parse(JSON.parse(raw)).code).toBe("INTERNAL_ERROR");
  });
});
