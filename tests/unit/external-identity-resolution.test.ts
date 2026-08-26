import { describe, expect, it, vi } from "vitest";

import { IdentityExternalAuthorityAdapter } from "../../apps/api/src/composition/identity-external-authority.adapter.js";
import { ExternalIdentity, InvalidExternalIdentityError } from "../../services/identity/src/index.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IDENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("external identity resolution", () => {
  it("preserves issuer and subject as the external security key", () => {
    expect(ExternalIdentity.create({
      issuer: "https://tenant.auth0.com", subject: "auth0|subject",
      internalIdentityId: IDENTITY_ID, tenantId: TENANT_ID, createdAt: "2026-08-26T12:00:00Z",
    })).toMatchObject({ issuer: "https://tenant.auth0.com/", subject: "auth0|subject", internalIdentityId: IDENTITY_ID });
  });

  it("rejects an invalid issuer or blank subject", () => {
    expect(() => ExternalIdentity.create({
      issuer: "http://tenant.auth0.com", subject: "auth0|subject",
      internalIdentityId: IDENTITY_ID, tenantId: TENANT_ID, createdAt: "2026-08-26T12:00:00Z",
    })).toThrow(InvalidExternalIdentityError);
    expect(() => ExternalIdentity.create({
      issuer: "https://tenant.auth0.com/", subject: " ",
      internalIdentityId: IDENTITY_ID, tenantId: TENANT_ID, createdAt: "2026-08-26T12:00:00Z",
    })).toThrow(InvalidExternalIdentityError);
  });

  it("derives authority only from the internal role and tenant membership", async () => {
    const resolve = vi.fn().mockResolvedValue({
      identityId: IDENTITY_ID, role: "TENANT_ADMINISTRATOR", tenantIds: [TENANT_ID],
    });
    const adapter = new IdentityExternalAuthorityAdapter({ resolve });
    const context = {
      issuer: "https://tenant.auth0.com/", subject: "auth0|subject", authenticationMethods: [],
      email: "attacker@example.test", roles: ["platform-admin"], scope: "CREATE_TENANT",
    };
    const authority = await adapter.resolve(context);
    expect(resolve).toHaveBeenCalledWith(context.issuer, context.subject);
    expect(authority).toMatchObject({ actorId: IDENTITY_ID, authorityId: IDENTITY_ID, tenantIds: [TENANT_ID] });
    expect(authority?.grants).not.toContain("CREATE_TENANT");
  });

  it("keeps an unknown external identity unresolved", async () => {
    const adapter = new IdentityExternalAuthorityAdapter({ resolve: async () => undefined });
    await expect(adapter.resolve({
      issuer: "https://tenant.auth0.com/", subject: "unknown", authenticationMethods: [],
    })).resolves.toBeUndefined();
  });
});
