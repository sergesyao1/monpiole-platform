import { describe, expect, it, vi } from "vitest";

import type {
  ExternalIdentityAuthorityResolver,
} from "../../../apps/api/src/authentication/oidc-authenticated-authority-provider.js";
import {
  PlatformExternalAuthorityResolver,
  platformSubjectAuthorityConfigurationFromEnvironment,
} from "../../../apps/api/src/authentication/platform-authenticated-authority-provider.js";
import {
  toPropertyAuthority,
} from "../../../apps/api/src/http/authenticated-authority/authenticated-authority.js";

describe("PlatformExternalAuthorityResolver", () => {
  it("composes canonical tenant authority with explicit platform grants", async () => {
    const canonicalIdentityId =
      "b06652ce-98a9-4bb1-afe6-eaeda8eb8b83";
    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn().mockResolvedValue({
        actorId: canonicalIdentityId,
        authorityId: canonicalIdentityId,
        grants: [
          "LIST_PROPERTY_OWNERS",
          "RETRIEVE_AGENCY_REGISTRATIONS",
        ] as const,
        tenantIds: [
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ],
      }),
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
      actorId: canonicalIdentityId,
      authorityId: "platform:auth0|platform-reviewer",
      grants: [
        "LIST_PROPERTY_OWNERS",
        "RETRIEVE_AGENCY_REGISTRATIONS",
        "REVIEW_AGENCY_REGISTRATIONS",
        "DECIDE_AGENCY_REGISTRATIONS",
        "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
      ],
      tenantIds: [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ],
    });

    expect(authority).not.toBeUndefined();
    if (authority === undefined) {
      throw new Error("Expected composed platform authority");
    }
    expect(new Set(authority.grants).size).toBe(authority.grants.length);
    expect(toPropertyAuthority(authority)).toEqual({
      actorId: canonicalIdentityId,
      authorityId: "platform:auth0|platform-reviewer",
      grants: ["LIST_PROPERTY_OWNERS"],
      tenantIds: [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ],
    });

    expect(fallback.resolve).toHaveBeenCalledWith({
      issuer: "https://issuer.example/",
      subject: "auth0|platform-reviewer",
      authenticationMethods: [],
    });
  });

  it("does not invent tenant grants for a platform subject", async () => {
    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn().mockResolvedValue({
        actorId: "identity-1",
        authorityId: "identity-1",
        grants: ["RETRIEVE_PROPERTY"] as const,
        tenantIds: ["tenant-1"],
      }),
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

    expect(authority).not.toBeUndefined();
    if (authority === undefined) {
      throw new Error("Expected composed platform authority");
    }
    expect(authority.grants).toContain("RETRIEVE_PROPERTY");
    expect(authority.grants).not.toContain("LIST_PROPERTY_OWNERS");
    expect(authority.grants).not.toContain("CREATE_TENANT");
    expect(authority.tenantIds).toEqual(["tenant-1"]);
    expect(toPropertyAuthority(authority).grants).toEqual([
      "RETRIEVE_PROPERTY",
    ]);
  });

  it("fails closed when a configured platform subject has no canonical identity", async () => {
    const fallback: ExternalIdentityAuthorityResolver = {
      resolve: vi.fn().mockResolvedValue(undefined),
    };
    const resolver = new PlatformExternalAuthorityResolver(
      {
        issuer: "https://issuer.example/",
        subjects: ["auth0|unlinked-reviewer"],
      },
      fallback,
    );

    await expect(resolver.resolve({
      issuer: "https://issuer.example/",
      subject: "auth0|unlinked-reviewer",
      authenticationMethods: [],
    })).resolves.toBeUndefined();
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
