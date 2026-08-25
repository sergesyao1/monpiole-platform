import type { IdentityOnboardingAuthorizer } from "@monpiole/identity";
import type {
  ActivateTenantAuthorizer,
  PlatformAuthority,
  PlatformAuthorityAuthorizer,
} from "@monpiole/tenant-management";

export class OnboardingAuthorityPolicy implements
PlatformAuthorityAuthorizer, ActivateTenantAuthorizer, IdentityOnboardingAuthorizer {
  async authorizeCreateTenant(authority: PlatformAuthority): Promise<boolean> {
    return authority.grants.includes("CREATE_TENANT");
  }

  async authorizeActivateTenant(authority: PlatformAuthority, tenantId: string): Promise<boolean> {
    return authority.grants.includes("ACTIVATE_TENANT") && authority.tenantIds.includes(tenantId);
  }

  async authorize(
    authority: Parameters<IdentityOnboardingAuthorizer["authorize"]>[0],
    grant: Parameters<IdentityOnboardingAuthorizer["authorize"]>[1],
    tenantId: string,
  ): Promise<boolean> {
    return authority.grants.includes(grant) && authority.tenantIds.includes(tenantId);
  }
}
