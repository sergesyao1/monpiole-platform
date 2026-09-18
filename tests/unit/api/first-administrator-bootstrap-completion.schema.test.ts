import { describe, expect, it } from "vitest";

import {
  CompleteFirstAdministratorIdentityRequestSchema,
  CompleteFirstAdministratorIdentityResponseSchema,
} from "../../../apps/api/src/contracts/v1/agency-onboarding/first-administrator.schema.js";

describe("CompleteFirstAdministratorIdentityRequestSchema", () => {
  it("accepts only the opaque bootstrap token", () => {
    expect(
      CompleteFirstAdministratorIdentityRequestSchema.parse({
        bootstrapToken: "opaque-bootstrap-token",
      }),
    ).toEqual({
      bootstrapToken: "opaque-bootstrap-token",
    });
  });

  it.each([
    ["tenantId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["administratorId", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    ["issuer", "https://attacker.example.test/"],
    ["subject", "auth0|attacker"],
    ["role", "TENANT_ADMINISTRATOR"],
  ])(
    "rejects client-controlled %s",
    (field, value) => {
      expect(
        CompleteFirstAdministratorIdentityRequestSchema.safeParse({
          bootstrapToken: "opaque-bootstrap-token",
          [field]: value,
        }).success,
      ).toBe(false);
    },
  );
});

describe("CompleteFirstAdministratorIdentityResponseSchema", () => {
  it("publishes the fully active administrator bootstrap result", () => {
    const result =
      CompleteFirstAdministratorIdentityResponseSchema.parse({
        registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        administratorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "TENANT_ADMINISTRATOR",
        status: "ACTIVE",
        identityLinkedAt: "2026-09-18T22:00:00.000Z",
        activatedAt: "2026-09-18T22:05:00.000Z",
      });

    expect(result.status).toBe("ACTIVE");
    expect(result.activatedAt).toBe(
      "2026-09-18T22:05:00.000Z",
    );
  });

  it("rejects the intermediate identity-linked response", () => {
    expect(
      CompleteFirstAdministratorIdentityResponseSchema.safeParse({
        registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        administratorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "TENANT_ADMINISTRATOR",
        status: "IDENTITY_LINKED",
        identityLinkedAt: "2026-09-18T22:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
