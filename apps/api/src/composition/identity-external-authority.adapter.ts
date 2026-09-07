import type { ExternalIdentityResolver, ResolvedExternalIdentityAuthority } from "@monpiole/identity";

import type { ExternalIdentityAuthorityResolver } from "../authentication/oidc-authenticated-authority-provider.js";
import type { VerifiedAuthenticationContext } from "../authentication/verified-authentication-context.js";
import type { AuthenticatedAuthority, AuthorityGrant } from "../http/authenticated-authority/authenticated-authority.js";

const TENANT_ADMINISTRATOR_GRANTS: readonly AuthorityGrant[] = Object.freeze([
  "ACTIVATE_TENANT", "BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR",
  "CREATE_PROPERTY", "RETRIEVE_PROPERTY", "LIST_PROPERTIES", "UPDATE_PROPERTY_DETAILS", "UPDATE_PROPERTY_CORE_INFORMATION", "UPDATE_PROPERTY_PRICING",
  "PUBLISH_PROPERTY", "WITHDRAW_PROPERTY_FROM_CATALOG",
  "RETRIEVE_PROPERTY_AVAILABILITY", "UPDATE_PROPERTY_AVAILABILITY",
  "RETRIEVE_PROPERTY_GEOLOCATION", "UPDATE_PROPERTY_GEOLOCATION", "REMOVE_PROPERTY_GEOLOCATION",
  "CREATE_PROPERTY_PHOTO", "RETRIEVE_PROPERTY_PHOTOS", "SELECT_PROPERTY_PRIMARY_PHOTO", "DELETE_PROPERTY_PHOTO",
  "RETRIEVE_PROPERTY_PHOTO_STANDARD", "MANAGE_PROPERTY_PHOTO_STANDARD",
  "CREATE_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNER", "LIST_PROPERTY_OWNERS", "UPDATE_PROPERTY_OWNER",
  "CREATE_PROPERTY_BUILDING", "RETRIEVE_PROPERTY_COMPOSITION", "UPDATE_PROPERTY_BUILDING", "CREATE_PROPERTY_UNIT", "UPDATE_PROPERTY_UNIT_STRUCTURE",
  "ASSIGN_PROPERTY_OWNER", "RETRIEVE_PROPERTY_OWNERSHIP", "REMOVE_PROPERTY_OWNER",
]);

export class IdentityExternalAuthorityAdapter implements ExternalIdentityAuthorityResolver {
  constructor(private readonly identities: ExternalIdentityResolver) {}

  async resolve(context: VerifiedAuthenticationContext): Promise<AuthenticatedAuthority | undefined> {
    const resolved = await this.identities.resolve(context.issuer, context.subject);
    return resolved === undefined ? undefined : toAuthenticatedAuthority(resolved);
  }
}

function toAuthenticatedAuthority(resolved: ResolvedExternalIdentityAuthority): AuthenticatedAuthority {
  if (resolved.role !== "TENANT_ADMINISTRATOR") throw new Error("Unsupported internal authority role");
  return {
    actorId: resolved.identityId,
    authorityId: resolved.identityId,
    grants: TENANT_ADMINISTRATOR_GRANTS,
    tenantIds: resolved.tenantIds,
  };
}
