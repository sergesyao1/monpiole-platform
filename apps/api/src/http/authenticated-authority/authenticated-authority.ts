import { UnauthorizedException } from "@nestjs/common";
import type { IdentityOnboardingAuthority, IdentityOnboardingGrant } from "@monpiole/identity";
import type { PlatformAuthority, TenantOnboardingGrant } from "@monpiole/tenant-management";
import type { PropertyAuthority, PropertyGrant } from "@monpiole/property-management";

import type { RequestWithContext } from "../request-context/request-context.js";

export type AuthorityGrant = TenantOnboardingGrant | IdentityOnboardingGrant | PropertyGrant;

export interface AuthenticatedAuthority {
  readonly actorId: string;
  readonly authorityId: string;
  readonly grants: readonly AuthorityGrant[];
  readonly tenantIds: readonly string[];
}

export interface AuthenticatedAuthorityProvider {
  resolve(request: RequestWithContext): Promise<AuthenticatedAuthority | undefined>;
}

export const AUTHENTICATED_AUTHORITY_PROVIDER = Symbol(
  "monpiole.authenticated-authority-provider",
);

export async function requireAuthenticatedAuthority(
  provider: AuthenticatedAuthorityProvider,
  request: RequestWithContext,
): Promise<AuthenticatedAuthority> {
  const authority = await provider.resolve(request);
  if (authority === undefined) throw new UnauthorizedException("Authentication required");
  return authority;
}

export function toTenantManagementAuthority(authority: AuthenticatedAuthority): PlatformAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter((grant): grant is TenantOnboardingGrant =>
      grant === "CREATE_TENANT" || grant === "ACTIVATE_TENANT"),
    tenantIds: authority.tenantIds,
  };
}

export function toIdentityOnboardingAuthority(authority: AuthenticatedAuthority): IdentityOnboardingAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter((grant): grant is IdentityOnboardingGrant =>
      grant === "BOOTSTRAP_TENANT_ADMINISTRATOR" || grant === "ACTIVATE_TENANT_ADMINISTRATOR"),
    tenantIds: authority.tenantIds,
  };
}

export function toPropertyAuthority(authority: AuthenticatedAuthority): PropertyAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter((grant): grant is PropertyGrant =>
      grant === "CREATE_PROPERTY" || grant === "RETRIEVE_PROPERTY" || grant === "UPDATE_PROPERTY_DETAILS"
      || grant === "CREATE_PROPERTY_OWNER" || grant === "RETRIEVE_PROPERTY_OWNER" || grant === "UPDATE_PROPERTY_OWNER"),
    tenantIds: authority.tenantIds,
  };
}
