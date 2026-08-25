import { UnauthorizedException } from "@nestjs/common";
import type { IdentityOnboardingAuthority, IdentityOnboardingGrant } from "@monpiole/identity";
import type { PlatformAuthority, TenantOnboardingGrant } from "@monpiole/tenant-management";

import type { RequestWithContext } from "../request-context/request-context.js";

export type OnboardingGrant = TenantOnboardingGrant | IdentityOnboardingGrant;

export interface AuthenticatedOnboardingAuthority {
  readonly actorId: string;
  readonly authorityId: string;
  readonly grants: readonly OnboardingGrant[];
  readonly tenantIds: readonly string[];
}

export interface AuthenticatedOnboardingAuthorityProvider {
  resolve(request: RequestWithContext): Promise<AuthenticatedOnboardingAuthority | undefined>;
}

export const AUTHENTICATED_ONBOARDING_AUTHORITY_PROVIDER = Symbol(
  "monpiole.authenticated-onboarding-authority-provider",
);

export async function requireAuthenticatedOnboardingAuthority(
  provider: AuthenticatedOnboardingAuthorityProvider,
  request: RequestWithContext,
): Promise<AuthenticatedOnboardingAuthority> {
  const authority = await provider.resolve(request);
  if (authority === undefined) throw new UnauthorizedException("Authentication required");
  return authority;
}

export function toTenantManagementAuthority(authority: AuthenticatedOnboardingAuthority): PlatformAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter((grant): grant is TenantOnboardingGrant =>
      grant === "CREATE_TENANT" || grant === "ACTIVATE_TENANT"),
    tenantIds: authority.tenantIds,
  };
}

export function toIdentityOnboardingAuthority(authority: AuthenticatedOnboardingAuthority): IdentityOnboardingAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter((grant): grant is IdentityOnboardingGrant =>
      grant === "BOOTSTRAP_TENANT_ADMINISTRATOR" || grant === "ACTIVATE_TENANT_ADMINISTRATOR"),
    tenantIds: authority.tenantIds,
  };
}
