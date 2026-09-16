import type {
  AgencyTenantProvisioningPort,
  AgencyTenantProvisioningResult,
} from "@monpiole/agency-onboarding";
import type {
  CreateTenant,
  PlatformAuthority,
} from "@monpiole/tenant-management";

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
    private readonly createTenant: Pick<CreateTenant, "execute">,
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

    const result = await this.createTenant.execute({
      authority: AGENCY_TENANT_PROVISIONING_AUTHORITY,
      organizationName: registration.agencyLegalName,
      responsiblePersonName,
      responsibleEmail: registration.contactEmail,
      responsibleTelephone: registration.contactPhone,
      country: registration.countryCode,
      correlationId: registration.correlationId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      tenantId: result.tenantId,
      lifecycleState: result.lifecycleState,
    };
  }
}
