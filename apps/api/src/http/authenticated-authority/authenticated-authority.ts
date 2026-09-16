import { UnauthorizedException } from "@nestjs/common";
import type {
  AgencyOnboardingAuthority,
  AgencyOnboardingGrant,
} from "@monpiole/agency-onboarding";
import type { IdentityOnboardingAuthority, IdentityOnboardingGrant } from "@monpiole/identity";
import type { PlatformAuthority, TenantOnboardingGrant } from "@monpiole/tenant-management";
import type { PropertyAuthority, PropertyGrant } from "@monpiole/property-management";

import type { RequestWithContext } from "../request-context/request-context.js";

export type AuthorityGrant =
  | TenantOnboardingGrant
  | IdentityOnboardingGrant
  | PropertyGrant
  | AgencyOnboardingGrant;

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

export function toAgencyOnboardingAuthority(
  authority: AuthenticatedAuthority,
): AgencyOnboardingAuthority {
  return {
    actorId: authority.actorId,
    authorityId: authority.authorityId,
    grants: authority.grants.filter(
      (grant): grant is AgencyOnboardingGrant =>
        grant === "RETRIEVE_AGENCY_REGISTRATIONS" ||
        grant === "REVIEW_AGENCY_REGISTRATIONS" ||
        grant === "DECIDE_AGENCY_REGISTRATIONS",
    ),
  };
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
      grant === "CREATE_PROPERTY" || grant === "RETRIEVE_PROPERTY" || grant === "LIST_PROPERTIES" || grant === "UPDATE_PROPERTY_DETAILS" || grant === "UPDATE_PROPERTY_CORE_INFORMATION" || grant === "UPDATE_PROPERTY_PRICING"
      || grant === "CREATE_PROPERTY_OWNER" || grant === "RETRIEVE_PROPERTY_OWNER" || grant === "LIST_PROPERTY_OWNERS" || grant === "UPDATE_PROPERTY_OWNER"
      || grant === "CREATE_PROPERTY_BUILDING" || grant === "RETRIEVE_PROPERTY_COMPOSITION" || grant === "UPDATE_PROPERTY_BUILDING"
      || grant === "CREATE_PROPERTY_UNIT" || grant === "UPDATE_PROPERTY_UNIT_STRUCTURE"
      || grant === "PUBLISH_PROPERTY" || grant === "WITHDRAW_PROPERTY_FROM_CATALOG"
      || grant === "RETRIEVE_PROPERTY_AVAILABILITY" || grant === "UPDATE_PROPERTY_AVAILABILITY"
      || grant === "RETRIEVE_PROPERTY_GEOLOCATION" || grant === "UPDATE_PROPERTY_GEOLOCATION" || grant === "REMOVE_PROPERTY_GEOLOCATION"
      || grant === "CREATE_PROPERTY_PHOTO" || grant === "RETRIEVE_PROPERTY_PHOTOS"
      || grant === "SELECT_PROPERTY_PRIMARY_PHOTO" || grant === "DELETE_PROPERTY_PHOTO"
      || grant === "REORDER_PROPERTY_PHOTOS"
      || grant === "RETRIEVE_PROPERTY_PHOTO_STANDARD" || grant === "MANAGE_PROPERTY_PHOTO_STANDARD"
      || grant === "ASSIGN_PROPERTY_OWNER" || grant === "RETRIEVE_PROPERTY_OWNERSHIP" || grant === "REMOVE_PROPERTY_OWNER"
      || grant === "RETRIEVE_PROPERTY_WORKSPACE"
      || grant === "RETRIEVE_PROPERTY_AMENITIES" || grant === "UPDATE_PROPERTY_AMENITIES"
      || grant === "CREATE_PROPERTY_CLIENT" || grant === "RETRIEVE_PROPERTY_CLIENTS"
      || grant === "CREATE_PROPERTY_CONTRACT" || grant === "RETRIEVE_PROPERTY_CONTRACTS"
      || grant === "CREATE_PROPERTY_CONTRACT_FROM_APPLICATION"
      || grant === "UPDATE_PROPERTY_CONTRACT" || grant === "MANAGE_PROPERTY_CONTRACT_LIFECYCLE"
      || grant === "LIST_PROPERTY_INQUIRIES" || grant === "RETRIEVE_PROPERTY_INQUIRY" || grant === "MANAGE_PROPERTY_INQUIRIES"
      || grant === "RETRIEVE_PROPERTY_VIEWINGS" || grant === "MANAGE_PROPERTY_VIEWINGS"
      || grant === "RETRIEVE_PROPERTY_VIEWING_OUTCOMES" || grant === "MANAGE_PROPERTY_VIEWING_OUTCOMES"
      || grant === "RETRIEVE_PROPERTY_APPLICATIONS" || grant === "MANAGE_PROPERTY_APPLICATIONS"
      || grant === "MANAGE_PROPERTY_APPLICATION_CLIENT_CONVERSIONS"),
    tenantIds: authority.tenantIds,
  };
}
