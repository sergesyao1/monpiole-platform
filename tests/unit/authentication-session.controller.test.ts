import { describe, expect, it, vi } from "vitest";

import { AuthenticationSessionController } from "../../apps/api/src/http/authentication/authentication-session.controller.js";

describe("Authentication session controller", () => {
  it("confirms a resolved internal authority without exposing its grants or tenant scope", async () => {
    const resolve = vi.fn().mockResolvedValue({
      actorId: "actor", authorityId: "authority", grants: ["CREATE_TENANT"], tenantIds: ["tenant"],
    });
    const response = await new AuthenticationSessionController({ resolve }).execute({ headers: {} });
    expect(response).toEqual({ authenticated: true });
    expect(response).not.toHaveProperty("grants");
    expect(response).not.toHaveProperty("tenantIds");
  });

  it("rejects an unresolved identity", async () => {
    const controller = new AuthenticationSessionController({ resolve: vi.fn().mockResolvedValue(undefined) });
    await expect(controller.execute({ headers: {} })).rejects.toMatchObject({ status: 401 });
  });
});
