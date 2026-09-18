import { describe, expect, it, vi } from "vitest";

import type { ExternalIdentityLinkStore } from "@monpiole/identity";

import { AgencyExternalIdentityLinkAdapter } from "../../src/composition/agency-external-identity-link.adapter.js";

const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMINISTRATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ISSUER = "https://monpiole-dev-ci.eu.auth0.com/";
const SUBJECT = "auth0|first-agency-administrator";
const CREATED_AT = "2026-09-18T10:05:00.000Z";

describe("AgencyExternalIdentityLinkAdapter", () => {
  it("canonicalizes without persisting an external association", () => {
    const link = vi.fn(async () => undefined);

    const adapter = new AgencyExternalIdentityLinkAdapter({ link });

    expect(
      adapter.canonicalize({
        issuer: "https://monpiole-dev-ci.eu.auth0.com",
        subject: "  auth0|first-agency-administrator  ",
        internalIdentityId: ADMINISTRATOR_ID,
        tenantId: TENANT_ID,
        createdAt: CREATED_AT,
      }),
    ).toEqual({
      issuer: ISSUER,
      subject: SUBJECT,
    });

    expect(link).not.toHaveBeenCalled();
  });

  it("constructs the canonical Identity external association", async () => {
    const link = vi.fn(async () => undefined);

    const store: ExternalIdentityLinkStore = {
      link,
    };

    const adapter = new AgencyExternalIdentityLinkAdapter(store);

    await adapter.link({
      issuer: ISSUER,
      subject: SUBJECT,
      internalIdentityId: ADMINISTRATOR_ID,
      tenantId: TENANT_ID,
      createdAt: CREATED_AT,
    });

    expect(link).toHaveBeenCalledTimes(1);

    const externalIdentity = link.mock.calls[0]?.[0];

    expect(externalIdentity).toMatchObject({
      issuer: ISSUER,
      subject: SUBJECT,
      internalIdentityId: ADMINISTRATOR_ID,
      tenantId: TENANT_ID,
      createdAt: CREATED_AT,
    });
  });

  it("normalizes issuer and subject through the Identity domain", async () => {
    const link = vi.fn(async () => undefined);

    const adapter = new AgencyExternalIdentityLinkAdapter({ link });

    await expect(
      adapter.link({
        issuer: "https://monpiole-dev-ci.eu.auth0.com",
        subject: "  auth0|first-agency-administrator  ",
        internalIdentityId: ADMINISTRATOR_ID,
        tenantId: TENANT_ID,
        createdAt: CREATED_AT,
      }),
    ).resolves.toEqual({
      issuer: ISSUER,
      subject: SUBJECT,
    });

    expect(link).toHaveBeenCalledTimes(1);

    expect(link.mock.calls[0]?.[0]).toMatchObject({
      issuer: ISSUER,
      subject: SUBJECT,
      internalIdentityId: ADMINISTRATOR_ID,
      tenantId: TENANT_ID,
      createdAt: CREATED_AT,
    });
  });

  it("does not call the store when the external identity is invalid", async () => {
    const link = vi.fn(async () => undefined);

    const adapter = new AgencyExternalIdentityLinkAdapter({ link });

    await expect(
      adapter.link({
        issuer: "http://insecure.example.test",
        subject: SUBJECT,
        internalIdentityId: ADMINISTRATOR_ID,
        tenantId: TENANT_ID,
        createdAt: CREATED_AT,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EXTERNAL_IDENTITY",
      field: "issuer",
    });

    expect(link).not.toHaveBeenCalled();
  });

  it("propagates an Identity store conflict", async () => {
    const conflict = Object.assign(
      new Error("External identity is already linked"),
      {
        code: "EXTERNAL_IDENTITY_ALREADY_LINKED",
      },
    );

    const link = vi.fn(async () => {
      throw conflict;
    });

    const adapter = new AgencyExternalIdentityLinkAdapter({ link });

    await expect(
      adapter.link({
        issuer: ISSUER,
        subject: SUBJECT,
        internalIdentityId: ADMINISTRATOR_ID,
        tenantId: TENANT_ID,
        createdAt: CREATED_AT,
      }),
    ).rejects.toBe(conflict);
  });
});