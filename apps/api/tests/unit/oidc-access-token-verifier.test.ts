import { describe, expect, it } from "vitest";

import {
  verifiedAuthenticationContextFromClaims,
  verifiedEmailClaimNames,
} from "../../src/authentication/oidc-access-token-verifier.js";

const ISSUER = "https://monpiole-dev-ci.eu.auth0.com/";
const SUBJECT = "auth0|first-agency-administrator";
const EMAIL_CLAIMS = verifiedEmailClaimNames(
  "https://api.monpiole.local",
);

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    sub: SUBJECT,
    ...overrides,
  };
}

describe("verifiedAuthenticationContextFromClaims", () => {
  it("preserves a verified email when email_verified is boolean true", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: "  Administrator@Example.com  ",
        [EMAIL_CLAIMS.emailVerified]: true,
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBe("Administrator@Example.com");
    expect(context.emailVerified).toBe(true);
  });

  it("preserves boolean false without treating the email as verified", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: "administrator@example.com",
        [EMAIL_CLAIMS.emailVerified]: false,
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBe("administrator@example.com");
    expect(context.emailVerified).toBe(false);
  });

  it("does not accept string true as a verified-email claim", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: "administrator@example.com",
        [EMAIL_CLAIMS.emailVerified]: "true",
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBe("administrator@example.com");
    expect(context.emailVerified).toBeUndefined();
  });

  it("leaves emailVerified absent when email_verified is missing", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: "administrator@example.com",
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBe("administrator@example.com");
    expect(context.emailVerified).toBeUndefined();
  });

  it("does not expose an empty email claim", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: "   ",
        [EMAIL_CLAIMS.emailVerified]: true,
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBeUndefined();
    expect(context.emailVerified).toBe(true);
  });

  it("does not expose a non-string email claim", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({
        [EMAIL_CLAIMS.email]: 12345,
        [EMAIL_CLAIMS.emailVerified]: true,
      }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBeUndefined();
    expect(context.emailVerified).toBe(true);
  });

  it("does not trust standard email claims for the Auth0 API contract", () => {
    const context = verifiedAuthenticationContextFromClaims(
      claims({ email: "attacker@example.com", email_verified: true }),
      EMAIL_CLAIMS,
    );

    expect(context.email).toBeUndefined();
    expect(context.emailVerified).toBeUndefined();
  });

  it("derives stable namespaced claims from the verified API audience", () => {
    expect(EMAIL_CLAIMS).toEqual({
      email: "https://api.monpiole.local/claims/email",
      emailVerified:
        "https://api.monpiole.local/claims/email_verified",
    });
  });
});
