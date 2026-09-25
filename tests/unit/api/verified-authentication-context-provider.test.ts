import { describe, expect, it, vi } from "vitest";

import {
  OidcVerifiedAuthenticationContextProvider,
} from "../../../apps/api/src/authentication/verified-authentication-context-provider.js";
import type {
  RequestWithContext,
} from "../../../apps/api/src/http/request-context/request-context.js";

const VERIFIED = Object.freeze({
  issuer: "https://monpiole-dev-ci.eu.auth0.com/",
  subject: "auth0|first-agency-administrator",
  authenticationMethods: Object.freeze([]),
});

function request(
  authorization?: string,
): RequestWithContext {
  return {
    headers:
      authorization === undefined
        ? {}
        : { authorization },
  } as RequestWithContext;
}

describe("OidcVerifiedAuthenticationContextProvider", () => {
  it("returns the verified OIDC context for a bearer token", async () => {
    const verify = vi.fn(async () => VERIFIED);

    const provider =
      new OidcVerifiedAuthenticationContextProvider({ verify });

    await expect(
      provider.resolve(request("Bearer signed-token")),
    ).resolves.toEqual(VERIFIED);

    expect(verify).toHaveBeenCalledWith("signed-token");
  });

  it("does not authenticate a request without a bearer token", async () => {
    const verify = vi.fn(async () => VERIFIED);

    const provider =
      new OidcVerifiedAuthenticationContextProvider({ verify });

    await expect(provider.resolve(request())).resolves.toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not authenticate an invalid bearer token", async () => {
    const verify = vi.fn(async () => {
      throw new Error("Invalid token");
    });

    const provider =
      new OidcVerifiedAuthenticationContextProvider({ verify });

    await expect(
      provider.resolve(request("Bearer invalid-token")),
    ).resolves.toBeUndefined();
  });
});