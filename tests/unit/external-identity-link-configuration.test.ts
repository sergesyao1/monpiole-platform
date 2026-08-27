import { describe, expect, it } from "vitest";

import { externalIdentityLinkConfigurationFromEnvironment } from "../../apps/api/src/operations/external-identity-link-configuration.js";

const valid = {
  EXTERNAL_IDENTITY_ISSUER: "https://tenant.example/",
  EXTERNAL_IDENTITY_SUBJECT: "auth0|subject",
  EXTERNAL_IDENTITY_INTERNAL_ID: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  EXTERNAL_IDENTITY_TENANT_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("external identity link configuration", () => {
  it("reads the exact issuer, subject, internal identity and tenant", () => {
    expect(externalIdentityLinkConfigurationFromEnvironment(valid)).toEqual({
      issuer: valid.EXTERNAL_IDENTITY_ISSUER,
      subject: valid.EXTERNAL_IDENTITY_SUBJECT,
      internalIdentityId: valid.EXTERNAL_IDENTITY_INTERNAL_ID,
      tenantId: valid.EXTERNAL_IDENTITY_TENANT_ID,
    });
  });

  it.each(Object.keys(valid))("fails safely when %s is absent", (missing) => {
    const environment = { ...valid } as NodeJS.ProcessEnv;
    delete environment[missing];
    expect(() => externalIdentityLinkConfigurationFromEnvironment(environment)).toThrow(`${missing} is required`);
  });
});
