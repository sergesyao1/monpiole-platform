import { describe, expect, it } from "vitest";

import {
  CompleteFirstAdministratorIdentityRequestSchema,
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