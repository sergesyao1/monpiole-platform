import { describe, expect, it, vi } from "vitest";

import {
  PlatformAgencyRegistrationReadAuthorizationProbeController,
} from "../../apps/api/src/http/authentication/platform-agency-registration-read-authorization-probe.controller.js";

const platformAgencyReader = {
  actorId: "platform:test-user",
  authorityId: "platform:test-user",
  grants: ["RETRIEVE_AGENCY_REGISTRATIONS"] as const,
  tenantIds: [],
};

const tenantAdministrator = {
  actorId: "tenant:test-user",
  authorityId: "tenant:test-user",
  grants: ["ACTIVATE_TENANT"] as const,
  tenantIds: ["11111111-1111-4111-8111-111111111111"],
};

describe("platform agency registration read authorization probe", () => {
  it("returns 204-compatible void when the authenticated authority may retrieve agency registrations", async () => {
    const resolve = vi.fn().mockResolvedValue(platformAgencyReader);

    const controller =
      new PlatformAgencyRegistrationReadAuthorizationProbeController({
        resolve,
      });

    await expect(
      controller.execute({ headers: {} }),
    ).resolves.toBeUndefined();

    expect(resolve).toHaveBeenCalledOnce();
  });

  it("returns 403 when the authenticated authority lacks RETRIEVE_AGENCY_REGISTRATIONS", async () => {
    const controller =
      new PlatformAgencyRegistrationReadAuthorizationProbeController({
        resolve: vi.fn().mockResolvedValue(tenantAdministrator),
      });

    await expect(
      controller.execute({ headers: {} }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns 401 when no internal authority resolves", async () => {
    const controller =
      new PlatformAgencyRegistrationReadAuthorizationProbeController({
        resolve: vi.fn().mockResolvedValue(undefined),
      });

    await expect(
      controller.execute({ headers: {} }),
    ).rejects.toMatchObject({ status: 401 });
  });
});