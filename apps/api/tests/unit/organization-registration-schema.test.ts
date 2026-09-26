import { describe, expect, it } from "vitest";

import { SubmitOrganizationRegistrationRequestSchema } from "../../src/contracts/v1/agency-onboarding/agency-registration.schema.js";

const validRequest = {
  organizationType: "SCI",
  legalName: "SCI Patrimoine Horizon",
  registrationNumber: "CI-ABJ-2026-SCI-42",
  phone: "+2250102030405",
  email: "contact@example.invalid",
  address: "Cocody",
  city: "Abidjan",
  countryCode: "CI",
  contactFirstName: "Awa",
  contactLastName: "Kone",
  contactEmail: "awa@example.invalid",
  contactPhone: "+2250506070809",
  documents: [{
    documentType: "REGISTRATION_CERTIFICATE",
    uploadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  }],
};

describe("SubmitOrganizationRegistrationRequestSchema", () => {
  it("accepts a supported non-agency organization type", () => {
    expect(SubmitOrganizationRegistrationRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects an unknown organization type", () => {
    expect(SubmitOrganizationRegistrationRequestSchema.safeParse({
      ...validRequest,
      organizationType: "UNSUPPORTED",
    }).success).toBe(false);
  });
});
