import { describe, expect, it, vi } from "vitest";

import type {
  ExternalIdentityAuthorityResolver,
} from "../../../apps/api/src/authentication/oidc-authenticated-authority-provider.js";
import {
  PlatformExternalAuthorityResolver,
  platformSubjectAuthorityConfigurationFromEnvironment,
} from "../../../apps/api/src/authentication/platform-authenticated-authority-provider.js";

describe("PlatformExternalAuthorityResolver", () => {
  it("resolves a configured OIDC subject as a platform authority", async () => {
    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn(),
    };

    const resolver = new PlatformExternalAuthorityResolver(
      {
        issuer: "https://issuer.example/",
        subjects: ["auth0|platform-reviewer"],
      },
      fallback,
    );

    const authority = await resolver.resolve({
      issuer: "https://issuer.example/",
      subject: "auth0|platform-reviewer",
      authenticationMethods: [],
    });

    expect(authority).toEqual({
      actorId: "platform:auth0|platform-reviewer",
      authorityId: "platform:auth0|platform-reviewer",
      grants: [
        "RETRIEVE_AGENCY_REGISTRATIONS",
        "REVIEW_AGENCY_REGISTRATIONS",
        "DECIDE_AGENCY_REGISTRATIONS",
      ],
      tenantIds: [],
    });

    expect(fallback.resolve).not.toHaveBeenCalled();
  });

  it("falls back for an OIDC subject that is not configured as platform", async () => {
    const fallbackAuthority = {
      actorId: "identity-1",
      authorityId: "identity-1",
      grants: [] as const,
      tenantIds: ["tenant-1"],
    };

    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn().mockResolvedValue(fallbackAuthority),
    };

    const resolver = new PlatformExternalAuthorityResolver(
      {
        issuer: "https://issuer.example/",
        subjects: ["auth0|platform-reviewer"],
      },
      fallback,
    );

    const context = {
      issuer: "https://issuer.example/",
      subject: "auth0|tenant-admin",
      authenticationMethods: [] as const,
    };

    await expect(resolver.resolve(context)).resolves.toBe(
      fallbackAuthority,
    );

    expect(fallback.resolve).toHaveBeenCalledWith(context);
  });

  it("does not grant platform authority when the issuer differs", async () => {
    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn().mockResolvedValue(undefined),
    };

    const resolver = new PlatformExternalAuthorityResolver(
      {
        issuer: "https://issuer.example/",
        subjects: ["auth0|platform-reviewer"],
      },
      fallback,
    );

    await expect(
      resolver.resolve({
        issuer: "https://other-issuer.example/",
        subject: "auth0|platform-reviewer",
        authenticationMethods: [],
      }),
    ).resolves.toBeUndefined();

    expect(fallback.resolve).toHaveBeenCalledOnce();
  });
});

describe("platformSubjectAuthorityConfigurationFromEnvironment", () => {
  it("parses configured platform subjects", () => {
    expect(
      platformSubjectAuthorityConfigurationFromEnvironment({
        AUTHENTICATION_ISSUER: "https://issuer.example/",
        PLATFORM_AUTHORITY_SUBJECTS:
          " auth0|reviewer-1, auth0|reviewer-2 ",
      }),
    ).toEqual({
      issuer: "https://issuer.example/",
      subjects: [
        "auth0|reviewer-1",
        "auth0|reviewer-2",
      ],
    });
  });

  it("allows an empty platform subject list", () => {
    expect(
      platformSubjectAuthorityConfigurationFromEnvironment({
        AUTHENTICATION_ISSUER: "https://issuer.example/",
      }),
    ).toEqual({
      issuer: "https://issuer.example/",
      subjects: [],
    });
  });

  it("requires the authentication issuer", () => {
    expect(() =>
      platformSubjectAuthorityConfigurationFromEnvironment({}),
    ).toThrow(
      "AUTHENTICATION_ISSUER is required for platform authority resolution",
    );
  });
});
