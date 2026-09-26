import type {
  AgencyTenantProvisioningPort,
  AgencyTenantProvisioningResult,
} from "@monpiole/agency-onboarding";
import type {
  PlatformAuthority,
  ProvisionOrganizationTenant,
} from "@monpiole/tenant-management";

const E164_PHONE = /^\+[1-9][0-9]{1,14}$/;
const COTE_DIVOIRE_COUNTRY_CODE = "CI";
const COTE_DIVOIRE_CALLING_CODE = "+225";
const COTE_DIVOIRE_NATIONAL_PHONE = /^0[0-9]{9}$/;

export function canonicalizeAgencyContactPhone(
  phone: string,
  countryCode: string,
): string {
  const normalizedPhone = phone.trim();

  if (E164_PHONE.test(normalizedPhone)) {
    return normalizedPhone;
  }

  const normalizedCountryCode =
    countryCode.trim().toUpperCase();

  if (
    normalizedCountryCode === COTE_DIVOIRE_COUNTRY_CODE &&
    COTE_DIVOIRE_NATIONAL_PHONE.test(normalizedPhone)
  ) {
    return `${COTE_DIVOIRE_CALLING_CODE}${normalizedPhone}`;
  }

  throw new Error(
    "Agency contact phone cannot be canonicalized to E.164",
  );
}

const AGENCY_TENANT_PROVISIONING_AUTHORITY: PlatformAuthority =
  Object.freeze({
    actorId: "system:agency-tenant-provisioning",
    authorityId: "system:agency-tenant-provisioning",
    grants: Object.freeze(["CREATE_TENANT"] as const),
    tenantIds: Object.freeze([]),
  });

export class AgencyTenantProvisioningAdapter
  implements AgencyTenantProvisioningPort
{
  public constructor(
    private readonly provisionOrganizationTenant:
      Pick<ProvisionOrganizationTenant, "execute">,
  ) {}

  public async provision(
    input: Parameters<AgencyTenantProvisioningPort["provision"]>[0],
  ): Promise<AgencyTenantProvisioningResult> {
    const registration = input.registration;

    const responsiblePersonName = [
      registration.contactFirstName,
      registration.contactLastName,
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(" ");

    const result =
      await this.provisionOrganizationTenant.execute({
        authority: AGENCY_TENANT_PROVISIONING_AUTHORITY,
        correlationId: registration.correlationId,
        idempotencyKey: input.idempotencyKey,

        tenant: {
          organizationName: registration.agencyLegalName,
          responsiblePersonName,
          responsibleEmail: registration.contactEmail,
          responsibleTelephone:
            canonicalizeAgencyContactPhone(
              registration.contactPhone,
              registration.countryCode,
            ),
          country: registration.countryCode,
        },

        organization: {
          type:
            registration.organizationType ??
            "REAL_ESTATE_AGENCY",
          legalName: registration.agencyLegalName,
          ...(registration.agencyTradeName === undefined
            ? {}
            : { tradeName: registration.agencyTradeName }),
          registrationNumber:
            registration.registrationNumber,
          ...(registration.taxIdentifier === undefined
            ? {}
            : { taxIdentifier: registration.taxIdentifier }),
          phone: registration.phone,
          email: registration.email,
          ...(registration.website === undefined
            ? {}
            : { website: registration.website }),
          address: registration.address,
          city: registration.city,
          countryCode: registration.countryCode,
        },
      });

    return {
      tenantId: result.tenantId,
      lifecycleState: result.lifecycleState,
    };
  }
}
