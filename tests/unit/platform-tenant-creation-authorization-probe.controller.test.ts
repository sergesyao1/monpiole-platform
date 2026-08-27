import { describe, expect, it, vi } from "vitest";

import { PlatformTenantCreationAuthorizationProbeController } from "../../apps/api/src/http/authentication/platform-tenant-creation-authorization-probe.controller.js";

const tenantAdministrator = {
  actorId: "identity", authorityId: "identity",
  grants: ["ACTIVATE_TENANT"] as const, tenantIds: ["tenant"],
};

describe("platform tenant creation authorization probe", () => {
  it("returns 403 from the existing backend authorizer without a business side effect", async () => {
    const authorizeCreateTenant = vi.fn().mockResolvedValue(false);
    const controller = new PlatformTenantCreationAuthorizationProbeController(
      { resolve: vi.fn().mockResolvedValue(tenantAdministrator) }, { authorizeCreateTenant },
    );
    await expect(controller.execute({ headers: {} })).rejects.toMatchObject({ status: 403 });
    expect(authorizeCreateTenant).toHaveBeenCalledWith(tenantAdministrator);
  });

  it("returns 204-compatible void only when the backend authorizer allows CREATE_TENANT", async () => {
    const controller = new PlatformTenantCreationAuthorizationProbeController(
      { resolve: vi.fn().mockResolvedValue({ ...tenantAdministrator, grants: ["CREATE_TENANT"] }) },
      { authorizeCreateTenant: vi.fn().mockResolvedValue(true) },
    );
    await expect(controller.execute({ headers: {} })).resolves.toBeUndefined();
  });

  it("returns 401 when no internal authority resolves", async () => {
    const controller = new PlatformTenantCreationAuthorizationProbeController(
      { resolve: vi.fn().mockResolvedValue(undefined) }, { authorizeCreateTenant: vi.fn() },
    );
    await expect(controller.execute({ headers: {} })).rejects.toMatchObject({ status: 401 });
  });
});
