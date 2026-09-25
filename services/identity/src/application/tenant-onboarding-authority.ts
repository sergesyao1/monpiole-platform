export type IdentityOnboardingGrant =
  | "BOOTSTRAP_TENANT_ADMINISTRATOR"
  | "ACTIVATE_TENANT_ADMINISTRATOR";

export interface IdentityOnboardingAuthority {
  readonly actorId: string;
  readonly authorityId: string;
  readonly grants: readonly IdentityOnboardingGrant[];
  readonly tenantIds: readonly string[];
}

export interface IdentityOnboardingAuthorizer {
  authorize(
    authority: IdentityOnboardingAuthority,
    grant: IdentityOnboardingGrant,
    tenantId: string,
  ): Promise<boolean>;
}

export class IdentityOnboardingForbiddenError extends Error {
  readonly code = "IDENTITY_ONBOARDING_FORBIDDEN";
}
