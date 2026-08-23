import { describe, expect, it } from "vitest";

import {
  createSyntheticTenantFixture,
  type SyntheticTenantFixture,
} from "../fixtures/synthetic-tenant.js";

const tenantAlpha = Object.freeze({
  tenantId: "tenant-smoke-alpha",
  correlationId: "correlation-smoke-alpha",
});

function readFixtureForTenant(
  fixture: SyntheticTenantFixture,
  tenantId: string,
): SyntheticTenantFixture {
  if (fixture.owner.tenantId !== tenantId) {
    throw new Error("Tenant context cannot access a fixture owned by another tenant.");
  }

  return fixture;
}

describe("unit testing baseline", () => {
  it("executes TypeScript through native ESM imports in the Node environment", () => {
    const runtimeProcess = Reflect.get(globalThis, "process") as
      | { release?: { name?: string } }
      | undefined;

    expect(import.meta.url.startsWith("file:")).toBe(true);
    expect(runtimeProcess?.release?.name).toBe("node");
  });

  it("creates the same synthetic fixture for the same explicit inputs", () => {
    const first = createSyntheticTenantFixture(tenantAlpha, 1);
    const second = createSyntheticTenantFixture(tenantAlpha, 1);

    expect(first).toEqual(second);
    expect(first.fixtureId).toBe("tenant-smoke-alpha-fixture-1");
  });

  it("asserts tenant isolation without shared mutable state", () => {
    const fixture = createSyntheticTenantFixture(tenantAlpha, 2);

    expect(readFixtureForTenant(fixture, tenantAlpha.tenantId)).toBe(fixture);
    expect(() => readFixtureForTenant(fixture, "tenant-smoke-beta")).toThrow(
      "Tenant context cannot access a fixture owned by another tenant.",
    );
  });
});
