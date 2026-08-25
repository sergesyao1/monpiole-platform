import { afterEach, describe, expect, it } from "vitest";

import { ContractBaselineResponseSchema } from "../../apps/api/src/contracts/v1/contract-baseline/contract-baseline.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";

describe("TD-006 NestJS HTTP contract baseline", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl: string;

  async function start() {
    application = await createApiApplication({ logger: false });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") {
      throw new Error("NestJS did not bind an ephemeral TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  it("validates a versioned request and serializes the canonical response", async () => {
    await start();
    const suppliedCorrelationId = "2005f02d-2f12-4eca-99e0-6b95117a80cd";
    const response = await fetch(`${baseUrl}/api/v1/contract-baseline`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant_demo",
        "x-correlation-id": suppliedCorrelationId,
        "x-request-id": "5aac49d5-c611-4998-855b-6e1411a5017e",
        "idempotency-key": "baseline-1",
      },
      body: JSON.stringify({ message: "  hello  " }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe(suppliedCorrelationId);
    const requestId = response.headers.get("x-request-id");
    expect(requestId).not.toBeNull();
    expect(requestId).not.toBe("5aac49d5-c611-4998-855b-6e1411a5017e");
    const body = await response.json();
    expect(ContractBaselineResponseSchema.parse(body)).toEqual(body);
    expect(body).toEqual({
      message: "hello",
      context: {
        tenantId: "tenant_demo",
        correlationId: suppliedCorrelationId,
        requestId,
        idempotencyKey: "baseline-1",
      },
    });
  });

  it("generates correlation and request IDs when correlation is absent", async () => {
    await start();
    const response = await fetch(`${baseUrl}/api/v1/contract-baseline`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant_demo",
        "idempotency-key": "baseline-2",
      },
      body: JSON.stringify({ message: "hello" }),
    });
    const body = ContractBaselineResponseSchema.parse(await response.json());
    expect(response.headers.get("x-correlation-id")).toBe(body.context.correlationId);
    expect(response.headers.get("x-request-id")).toBe(body.context.requestId);
  });

  it("returns a safe RFC 9457 problem for an unknown request property", async () => {
    await start();
    const response = await fetch(`${baseUrl}/api/v1/contract-baseline`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant_demo",
        "idempotency-key": "baseline-3",
      },
      body: JSON.stringify({ message: "hello", secret: "must-not-leak" }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("x-correlation-id")).not.toBeNull();
    expect(response.headers.get("x-request-id")).not.toBeNull();
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(response.headers.get("x-correlation-id")).not.toBeNull();
    expect(response.headers.get("x-request-id")).not.toBeNull();
    const raw = await response.text();
    expect(raw).not.toContain("must-not-leak");
    expect(raw).not.toContain("Zod");
    const problem = ProblemDetailsSchema.parse(JSON.parse(raw));
    expect(problem.code).toBe("INVALID_REQUEST");
    expect(problem.errors).toEqual([{ path: "body", code: "invalid" }]);
  });

  it.each([
    [{ "idempotency-key": "baseline-4" }, "headers.x-tenant-id", "missing"],
    [{ "x-tenant-id": "tenant_demo" }, "headers.idempotency-key", "missing"],
    [
      { "x-tenant-id": "tenant_demo", "idempotency-key": "contains space" },
      "headers.idempotency-key",
      "invalid",
    ],
  ])("makes context header requirements explicit", async (headers, path, code) => {
    await start();
    const response = await fetch(`${baseUrl}/api/v1/contract-baseline`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(response.status).toBe(400);
    const problem = ProblemDetailsSchema.parse(await response.json());
    expect(problem.errors).toEqual([{ path, code }]);
  });
});
