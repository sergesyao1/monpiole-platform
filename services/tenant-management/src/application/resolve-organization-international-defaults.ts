export interface OrganizationInternationalReferenceReader {
  getCountry(code: string): Promise<{
    readonly code: string;
    readonly defaultLanguageCode: string;
    readonly defaultLocale: string;
    readonly defaultCurrencyCode: string;
    readonly defaultTimezone: string;
    readonly active: boolean;
  } | undefined>;
  getLanguage(code: string): Promise<{ readonly active: boolean } | undefined>;
  getCurrency(code: string): Promise<{ readonly active: boolean } | undefined>;
  listLanguagesForCountry(code: string): Promise<readonly {
    readonly languageCode: string;
    readonly active: boolean;
    readonly language: { readonly active: boolean };
  }[]>;
}

export interface ResolveOrganizationInternationalDefaultsInput {
  readonly countryCode: string;
  readonly defaultLanguageCode?: string;
  readonly defaultLocale?: string;
  readonly defaultCurrencyCode?: string;
  readonly defaultTimezone?: string;
}

export class InvalidOrganizationInternationalConfigurationError extends Error {
  readonly code = "INVALID_ORGANIZATION_INTERNATIONAL_CONFIGURATION";

  constructor() {
    super("Invalid organization international configuration");
    this.name = "InvalidOrganizationInternationalConfigurationError";
  }
}

export class ResolveOrganizationInternationalDefaults {
  constructor(private readonly references: OrganizationInternationalReferenceReader) {}

  async execute(input: ResolveOrganizationInternationalDefaultsInput) {
    const countryCode = input.countryCode.trim().toUpperCase();
    const country = await this.references.getCountry(countryCode);
    if (country?.active !== true) this.reject();

    const defaultLanguageCode = (
      input.defaultLanguageCode ?? country.defaultLanguageCode
    ).trim().toLowerCase();
    const defaultLocale = (input.defaultLocale ?? country.defaultLocale).trim();
    const defaultCurrencyCode = (
      input.defaultCurrencyCode ?? country.defaultCurrencyCode
    ).trim().toUpperCase();
    const defaultTimezone = (
      input.defaultTimezone ?? country.defaultTimezone
    ).trim();

    const [language, currency, countryLanguages] = await Promise.all([
      this.references.getLanguage(defaultLanguageCode),
      this.references.getCurrency(defaultCurrencyCode),
      this.references.listLanguagesForCountry(country.code),
    ]);
    const supportedLanguage = countryLanguages.some(
      (candidate) =>
        candidate.languageCode === defaultLanguageCode &&
        candidate.active &&
        candidate.language.active,
    );
    if (language?.active !== true || currency?.active !== true || !supportedLanguage) {
      this.reject();
    }

    try {
      if (Intl.getCanonicalLocales(defaultLocale)[0] !== defaultLocale) {
        this.reject();
      }
      new Intl.DateTimeFormat("en", { timeZone: defaultTimezone }).format();
    } catch {
      this.reject();
    }

    return {
      defaultLanguageCode,
      defaultLocale,
      defaultCurrencyCode,
      defaultTimezone,
    };
  }

  private reject(): never {
    throw new InvalidOrganizationInternationalConfigurationError();
  }
}
