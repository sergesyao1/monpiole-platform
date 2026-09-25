import { describe, expect, it, vi } from "vitest";

import { OidcAuthenticatedAuthorityProvider } from "../../apps/api/src/authentication/oidc-authenticated-authority-provider.js";

const CONTEXT = { issuer: "https://login.example/", subject: "subject", authenticationMethods: [] };
const AUTHORITY = { actorId: "actor", authorityId: "authority", grants: ["CREATE_TENANT"] as const, tenantIds: [] };

describe("OIDC authenticated authority provider", () => {
  it("maps a verified external identity to internal authority data", async () => {
    const verify = vi.fn().mockResolvedValue(CONTEXT);
    const resolve = vi.fn().mockResolvedValue(AUTHORITY);
    const provider = new OidcAuthenticatedAuthorityProvider({ verify }, { resolve });
    await expect(provider.resolve({ headers: { authorization: "Bearer signed-token" } })).resolves.toEqual(AUTHORITY);
    expect(resolve).toHaveBeenCalledWith(CONTEXT);
  });

  it.each([
    ["missing credential", undefined],
    ["malformed credential", "Basic credential"],
  ])("rejects %s", async (_name, authorization) => {
    const provider = new OidcAuthenticatedAuthorityProvider({ verify: vi.fn() }, { resolve: vi.fn() });
    await expect(provider.resolve({ headers: { authorization } })).resolves.toBeUndefined();
  });

  it("fails closed for an invalid token, unknown subject, or disabled mapping", async () => {
    const invalidResolver = { resolve: vi.fn() };
    const invalid = new OidcAuthenticatedAuthorityProvider(
      { verify: vi.fn().mockRejectedValue(new Error("invalid")) }, invalidResolver,
    );
    await expect(invalid.resolve({ headers: { authorization: "Bearer invalid" } })).resolves.toBeUndefined();
    expect(invalidResolver.resolve).not.toHaveBeenCalled();
    const unresolved = new OidcAuthenticatedAuthorityProvider(
      { verify: vi.fn().mockResolvedValue(CONTEXT) }, { resolve: vi.fn().mockResolvedValue(undefined) },
    );
    await expect(unresolved.resolve({ headers: { authorization: "Bearer valid" } })).resolves.toBeUndefined();
  });
});
