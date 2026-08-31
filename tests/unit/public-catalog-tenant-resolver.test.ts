import { describe, expect, it } from "vitest";

import {
  publicCatalogHostAllowlistFromEnvironment,
} from "../../apps/api/src/configuration/public-catalog.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("public catalog exact Host allowlist", () => {
  it("is empty by default and accepts no host", () => {
    const allowlist = publicCatalogHostAllowlistFromEnvironment({});
    expect(allowlist.size).toBe(0);
    expect(allowlist.resolver.resolve("catalogue.test")).toBeUndefined();
  });

  it("matches only the configured canonical host, including its port", () => {
    const allowlist = publicCatalogHostAllowlistFromEnvironment({
      PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST: `catalogue.test:8443=${TENANT_ID}`,
      NODE_ENV: "test",
    });
    expect(allowlist.resolver.resolve("catalogue.test:8443")).toBe(TENANT_ID);
    expect(allowlist.resolver.resolve("CATALOGUE.TEST:8443")).toBe(TENANT_ID);
    expect(allowlist.resolver.resolve("catalogue.test")).toBeUndefined();
    expect(allowlist.resolver.resolve("catalogue.test:8443.evil.invalid")).toBeUndefined();
  });

  it.each([
    "*=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "https://catalogue.test=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "catalogue.test=not-an-id",
    `catalogue.test=${TENANT_ID},catalogue.test=${TENANT_ID}`,
  ])("rejects unsafe or ambiguous configuration %s", (value) => {
    expect(() => publicCatalogHostAllowlistFromEnvironment({ PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST: value }))
      .toThrow(/PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST/u);
  });

  it("keeps the production allowlist empty until Internet gates are approved", () => {
    expect(() => publicCatalogHostAllowlistFromEnvironment({
      MONPIOLE_ENV: "production",
      PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST: `catalogue.example=${TENANT_ID}`,
    })).toThrow(/must remain empty in production/u);
  });
});
