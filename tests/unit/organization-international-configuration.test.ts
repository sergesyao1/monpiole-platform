import { describe, expect, it } from "vitest";

import {
  InvalidOrganizationInternationalConfigurationError,
  ResolveOrganizationInternationalDefaults,
  type OrganizationInternationalReferenceReader,
} from "../../services/tenant-management/src/application/resolve-organization-international-defaults.js";
import {
  InvalidOrganizationInputError,
  Organization,
} from "../../services/tenant-management/src/domain/organization.js";

const countries = {
  CI: {
    code: "CI",
    defaultLanguageCode: "fr",
    defaultLocale: "fr-CI",
    defaultCurrencyCode: "XOF",
    defaultTimezone: "Africa/Abidjan",
    active: true,
  },
  GH: {
    code: "GH",
    defaultLanguageCode: "en",
    defaultLocale: "en-GH",
    defaultCurrencyCode: "GHS",
    defaultTimezone: "Africa/Accra",
    active: true,
  },
} as const;

function references(): OrganizationInternationalReferenceReader {
  return {
    getCountry: async (code) => countries[code as keyof typeof countries],
    getLanguage: async (code) =>
      ["fr", "en"].includes(code) ? { active: true } : undefined,
    getCurrency: async (code) =>
      ["XOF", "GHS"].includes(code) ? { active: true } : undefined,
    listLanguagesForCountry: async (code) => [{
      languageCode: code === "CI" ? "fr" : "en",
      active: true,
      language: { active: true },
    }],
  };
}

describe("ResolveOrganizationInternationalDefaults", () => {
  const resolver = new ResolveOrganizationInternationalDefaults(references());

  it.each([
    ["CI", "fr", "fr-CI", "XOF", "Africa/Abidjan"],
    ["GH", "en", "en-GH", "GHS", "Africa/Accra"],
  ])("resolves %s defaults from reference data", async (
    countryCode,
    defaultLanguageCode,
    defaultLocale,
    defaultCurrencyCode,
    defaultTimezone,
  ) => {
    await expect(resolver.execute({ countryCode })).resolves.toEqual({
      defaultLanguageCode,
      defaultLocale,
      defaultCurrencyCode,
      defaultTimezone,
    });
  });

  it("accepts valid explicit overrides", async () => {
    await expect(resolver.execute({
      countryCode: "GH",
      defaultLanguageCode: "en",
      defaultLocale: "en-GH",
      defaultCurrencyCode: "GHS",
      defaultTimezone: "Africa/Accra",
    })).resolves.toMatchObject({ defaultLocale: "en-GH" });
  });

  it.each([
    [{ countryCode: "ZZ" }],
    [{ countryCode: "CI", defaultLanguageCode: "en" }],
    [{ countryCode: "CI", defaultCurrencyCode: "USD" }],
    [{ countryCode: "CI", defaultLocale: "not_locale" }],
    [{ countryCode: "CI", defaultTimezone: "Abidjan" }],
  ])("rejects invalid or unsupported configuration", async (input) => {
    await expect(resolver.execute(input)).rejects.toBeInstanceOf(
      InvalidOrganizationInternationalConfigurationError,
    );
  });
});

describe("Organization international configuration", () => {
  const values = {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    type: "REAL_ESTATE_AGENCY" as const,
    legalName: "Example Immobilier",
    registrationNumber: "CI-ABJ-1",
    phone: "+2250102030405",
    email: "contact@example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    defaultLanguageCode: "fr",
    defaultLocale: "fr-CI",
    defaultCurrencyCode: "XOF",
    defaultTimezone: "Africa/Abidjan",
    createdAt: "2026-09-26T10:00:00.000Z",
    updatedAt: "2026-09-26T10:00:00.000Z",
  };

  it("accepts and retains explicit CI configuration", () => {
    expect(Organization.create(values).values).toMatchObject({
      countryCode: "CI",
      defaultLanguageCode: "fr",
      defaultLocale: "fr-CI",
      defaultCurrencyCode: "XOF",
      defaultTimezone: "Africa/Abidjan",
    });
  });

  it.each([
    ["defaultLanguageCode", "FR"],
    ["defaultCurrencyCode", "xof"],
    ["defaultLocale", "fr_ci"],
    ["defaultTimezone", "Abidjan"],
  ] as const)("rejects invalid %s", (field, value) => {
    expect(() => Organization.create({ ...values, [field]: value })).toThrow(
      InvalidOrganizationInputError,
    );
  });
});
