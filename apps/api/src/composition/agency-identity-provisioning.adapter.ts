import type {
  BootstrapTenantAdministrator,
  IdentityOnboardingAuthority,
} from "@monpiole/identity";
import type {
  FirstAdministratorIdentityProvisioningPort,
  ProvisionFirstAdministratorIdentityInput,
  ProvisionFirstAdministratorIdentityResult,
} from "@monpiole/agency-onboarding";

const AGENCY_IDENTITY_PROVISIONING_AUTHORITY_ID =
  "system:agency-identity-provisioning";

export class AgencyIdentityProvisioningAdapter
  implements FirstAdministratorIdentityProvisioningPort
{
  constructor(
    private readonly bootstrapAdministrator: Pick<
      BootstrapTenantAdministrator,
      "execute"
    >,
  ) {}

  async provision(
    input: ProvisionFirstAdministratorIdentityInput,
  ): Promise<ProvisionFirstAdministratorIdentityResult> {
    const authority = Object.freeze({
      actorId: input.requestedByPlatformIdentityId,
      authorityId: AGENCY_IDENTITY_PROVISIONING_AUTHORITY_ID,
      grants: ["BOOTSTRAP_TENANT_ADMINISTRATOR"],
      tenantIds: [input.tenantId],
    } satisfies IdentityOnboardingAuthority);

    const result = await this.bootstrapAdministrator.execute({
      tenantId: input.tenantId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      correlationId: input.correlationId,
      authority,
    });

    return Object.freeze({
      tenantId: result.tenantId,
      administratorId: result.administratorId,
      email: result.email,
      role: result.role,
      status: result.status,
    });
  }
}