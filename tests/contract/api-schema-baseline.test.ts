import { describe, expect, it } from "vitest";

import {
  ContractBaselineRequestSchema,
  ContractBaselineResponseSchema,
} from "../../apps/api/src/contracts/v1/contract-baseline/contract-baseline.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import { CreateTenantRequestSchema, CreateTenantResponseSchema } from "../../apps/api/src/contracts/v1/tenants/create-tenant.schema.js";
import {
  TENANT_CONTEXT_METADATA,
  TenantContext,
} from "../../apps/api/src/http/request-context/request-context.decorator.js";

describe("canonical Zod transport contracts", () => {
  it("accepts the strict baseline request and maps whitespace deterministically", () => {
    expect(ContractBaselineRequestSchema.parse({ message: "  hello  " })).toEqual({
      message: "hello",
    });
  });

  it.each([
    [{ message: "" }],
    [{ message: "hello", unexpected: true }],
    [{}],
  ])("rejects an invalid or unknown request shape", (payload: unknown) => {
    expect(ContractBaselineRequestSchema.safeParse(payload).success).toBe(false);
  });

  it("validates the response independently", () => {
    expect(
      ContractBaselineResponseSchema.safeParse({
        message: "hello",
        context: {
          tenantId: "tenant_demo",
          correlationId: "2005f02d-2f12-4eca-99e0-6b95117a80cd",
          requestId: "bc6a8a2f-44bc-4d4f-b997-a52c9ae2306f",
          idempotencyKey: "baseline-1",
        },
      }).success,
    ).toBe(true);
  });

  it("validates the safe RFC 9457 representation", () => {
    expect(
      ProblemDetailsSchema.safeParse({
        type: "https://api.monpiole.example/problems/invalid-request",
        title: "Invalid request",
        status: 400,
        code: "INVALID_REQUEST",
        correlationId: "2005f02d-2f12-4eca-99e0-6b95117a80cd",
        errors: [{ path: "body.message", code: "invalid" }],
      }).success,
    ).toBe(true);
  });

  it("supports an explicit pre-tenant route declaration", () => {
    class PreTenantFixture {
      execute() {}
    }
    TenantContext("not-applicable")(
      PreTenantFixture.prototype,
      "execute",
      Object.getOwnPropertyDescriptor(PreTenantFixture.prototype, "execute")!,
    );

    expect(
      Reflect.getMetadata(
        TENANT_CONTEXT_METADATA,
        PreTenantFixture.prototype.execute,
      ),
    ).toBe("not-applicable");
  });

  it("validates and normalizes the strict Create Tenant v1 transport contract", () => {
    expect(CreateTenantRequestSchema.parse({
      organizationName: " Agency ", responsiblePersonName: " Ada ", responsibleEmail: " ADA@EXAMPLE.INVALID ",
      responsibleTelephone: "+2250102030405", country: "CI",
    })).toEqual({ organizationName: "Agency", responsiblePersonName: "Ada", responsibleEmail: "ada@example.invalid",
      responsibleTelephone: "+2250102030405", country: "CI" });
    expect(CreateTenantRequestSchema.safeParse({ organizationName: "Agency", responsiblePersonName: "Ada",
      responsibleEmail: "ada@example.invalid", responsibleTelephone: "0102", country: "ci" }).success).toBe(false);
    expect(CreateTenantResponseSchema.safeParse({ tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lifecycleState: "PENDING" }).success).toBe(true);
    expect(CreateTenantResponseSchema.safeParse({ tenantId: "tenant_demo", lifecycleState: "PENDING" }).success).toBe(false);
  });
});
