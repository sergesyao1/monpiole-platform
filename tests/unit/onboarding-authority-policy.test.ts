import { describe, expect, it } from "vitest";

import { OnboardingAuthorityPolicy } from "../../apps/api/src/composition/onboarding-authority-policy.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Tenant Onboarding authority policy", () => {
  const policy = new OnboardingAuthorityPolicy();

  it("allows platform Create Tenant only with the explicit grant", async () => {
    await expect(policy.authorizeCreateTenant({
      actorId: "actor-1", authorityId: "authority-1", grants: ["CREATE_TENANT"], tenantIds: [],
    })).resolves.toBe(true);
    await expect(policy.authorizeCreateTenant({
      actorId: "actor-1", authorityId: "authority-1", grants: [], tenantIds: [],
    })).resolves.toBe(false);
  });

  it("requires both the operation grant and the target tenant scope", async () => {
    const authority = {
      actorId: "actor-1", authorityId: "authority-1",
      grants: ["ACTIVATE_TENANT"] as const, tenantIds: [TENANT_A],
    };
    await expect(policy.authorizeActivateTenant(authority, TENANT_A)).resolves.toBe(true);
    await expect(policy.authorizeActivateTenant(authority, TENANT_B)).resolves.toBe(false);
  });

  it("does not let an Identity grant cross tenant boundaries", async () => {
    const authority = {
      actorId: "actor-1", authorityId: "authority-1",
      grants: ["ACTIVATE_TENANT_ADMINISTRATOR"] as const, tenantIds: [TENANT_A],
    };
    await expect(policy.authorize(authority, "ACTIVATE_TENANT_ADMINISTRATOR", TENANT_A)).resolves.toBe(true);
    await expect(policy.authorize(authority, "ACTIVATE_TENANT_ADMINISTRATOR", TENANT_B)).resolves.toBe(false);
    await expect(policy.authorize(authority, "BOOTSTRAP_TENANT_ADMINISTRATOR", TENANT_A)).resolves.toBe(false);
  });
});
