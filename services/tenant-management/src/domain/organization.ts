const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const COUNTRY_CODE = /^[A-Z]{2}$/;

export const organizationTypes = [
  "REAL_ESTATE_AGENCY",
  "PROPERTY_MANAGEMENT_COMPANY",
  "SCI",
  "DEVELOPER",
  "SYNDIC",
  "PROFESSIONAL_LANDLORD",
  "OTHER",
] as const;

export type OrganizationType = (typeof organizationTypes)[number];

export interface CreateOrganizationValues {
  readonly id: string;
  readonly tenantId: string;
  readonly type: OrganizationType;

  readonly legalName: string;
  readonly tradeName?: string;
  readonly registrationNumber: string;
  readonly taxIdentifier?: string;

  readonly phone: string;
  readonly email: string;
  readonly website?: string;

  readonly address: string;
  readonly city: string;
  readonly countryCode: string;
  readonly defaultLanguageCode: string;
  readonly defaultLocale: string;
  readonly defaultCurrencyCode: string;
  readonly defaultTimezone: string;

  readonly createdAt: string;
  readonly updatedAt: string;
}

export class InvalidOrganizationInputError extends Error {
  readonly code = "INVALID_ORGANIZATION_INPUT";

  constructor(readonly field: keyof CreateOrganizationValues) {
    super(`Invalid organization ${field}`);
    this.name = "InvalidOrganizationInputError";
  }
}

export class Organization {
  private constructor(
    readonly values: Readonly<CreateOrganizationValues>,
  ) {}

  static create(values: CreateOrganizationValues): Organization {
    if (!UUID_V4.test(values.id)) {
      throw new InvalidOrganizationInputError("id");
    }

    if (!UUID_V4.test(values.tenantId)) {
      throw new InvalidOrganizationInputError("tenantId");
    }

    if (values.id === values.tenantId) {
      throw new InvalidOrganizationInputError("tenantId");
    }

    if (!organizationTypes.includes(values.type)) {
      throw new InvalidOrganizationInputError("type");
    }

    const legalName = required(values.legalName, "legalName");
    const registrationNumber = required(
      values.registrationNumber,
      "registrationNumber",
    );
    const phone = required(values.phone, "phone");
    const email = required(values.email, "email").toLowerCase();
    const address = required(values.address, "address");
    const city = required(values.city, "city");

    if (!COUNTRY_CODE.test(values.countryCode)) {
      throw new InvalidOrganizationInputError("countryCode");
    }
    if (!/^[a-z]{2,3}$/u.test(values.defaultLanguageCode)) {
      throw new InvalidOrganizationInputError("defaultLanguageCode");
    }
    if (!/^[A-Z]{3}$/u.test(values.defaultCurrencyCode)) {
      throw new InvalidOrganizationInputError("defaultCurrencyCode");
    }
    try {
      if (Intl.getCanonicalLocales(values.defaultLocale)[0] !== values.defaultLocale) {
        throw new Error("Non-canonical locale");
      }
    } catch {
      throw new InvalidOrganizationInputError("defaultLocale");
    }
    try {
      new Intl.DateTimeFormat("en", {
        timeZone: values.defaultTimezone,
      }).format();
    } catch {
      throw new InvalidOrganizationInputError("defaultTimezone");
    }

    if (!validTimestamp(values.createdAt)) {
      throw new InvalidOrganizationInputError("createdAt");
    }

    if (!validTimestamp(values.updatedAt)) {
      throw new InvalidOrganizationInputError("updatedAt");
    }

    if (Date.parse(values.updatedAt) < Date.parse(values.createdAt)) {
      throw new InvalidOrganizationInputError("updatedAt");
    }

    const tradeName = optional(values.tradeName);
    const taxIdentifier = optional(values.taxIdentifier);
    const website = optional(values.website);

    return new Organization(
      Object.freeze({
        id: values.id,
        tenantId: values.tenantId,
        type: values.type,

        legalName,
        ...(tradeName === undefined ? {} : { tradeName }),
        registrationNumber,
        ...(taxIdentifier === undefined ? {} : { taxIdentifier }),

        phone,
        email,
        ...(website === undefined ? {} : { website }),

        address,
        city,
        countryCode: values.countryCode,
        defaultLanguageCode: values.defaultLanguageCode,
        defaultLocale: values.defaultLocale,
        defaultCurrencyCode: values.defaultCurrencyCode,
        defaultTimezone: values.defaultTimezone,

        createdAt: values.createdAt,
        updatedAt: values.updatedAt,
      }),
    );
  }
}

function required(
  value: string,
  field: keyof CreateOrganizationValues,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new InvalidOrganizationInputError(field);
  }

  return normalized;
}

function optional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.endsWith("Z");
}
