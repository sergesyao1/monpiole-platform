import { describe, expect, it } from "vitest";

import {
  agencyFirstAdministratorCorrelationId,
} from "../../apps/api/src/composition/agency-first-administrator-correlation.js";

describe("agencyFirstAdministratorCorrelationId", () => {
  it("returns the same UUID for the same registration", () => {
    const registrationId =
      "11111111-1111-4111-8111-111111111111";

    const first =
      agencyFirstAdministratorCorrelationId(registrationId);

    const second =
      agencyFirstAdministratorCorrelationId(registrationId);

    expect(second).toBe(first);

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("normalizes UUID casing and surrounding whitespace", () => {
    const lower =
      agencyFirstAdministratorCorrelationId(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      );

    const upper =
      agencyFirstAdministratorCorrelationId(
        "  AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA  ",
      );

    expect(upper).toBe(lower);
  });

  it("returns different correlations for different registrations", () => {
    const first =
      agencyFirstAdministratorCorrelationId(
        "11111111-1111-4111-8111-111111111111",
      );

    const second =
      agencyFirstAdministratorCorrelationId(
        "22222222-2222-4222-8222-222222222222",
      );

    expect(second).not.toBe(first);
  });

  it("rejects a non-UUID registration identifier", () => {
    expect(() =>
      agencyFirstAdministratorCorrelationId(
        "not-a-registration-uuid",
      ),
    ).toThrow(
      "First administrator registrationId must be a UUID.",
    );
  });
});