import { describe, expect, it } from "vitest";

import { createSyntheticTenantFixture } from "../fixtures/synthetic-tenant.js";

describe("integration testing baseline", () => {
  it("discovers an infrastructure-free integration suite with isolated state", () => {
    const alpha = createSyntheticTenantFixture(
      {
        tenantId: "tenant-integration-alpha",
        correlationId: "correlation-integration-alpha",
      },
      1,
    );
    const beta = createSyntheticTenantFixture(
      {
        tenantId: "tenant-integration-beta",
        correlationId: "correlation-integration-beta",
      },
      1,
    );

    expect(alpha.owner.tenantId).not.toBe(beta.owner.tenantId);
    expect(alpha.fixtureId).not.toBe(beta.fixtureId);
  });
});
