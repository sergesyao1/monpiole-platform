export const agencyOnboardingGrants = [
  "RETRIEVE_AGENCY_REGISTRATIONS",
  "REVIEW_AGENCY_REGISTRATIONS",
  "DECIDE_AGENCY_REGISTRATIONS",
  "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
] as const;

export type AgencyOnboardingGrant =
  (typeof agencyOnboardingGrants)[number];

export interface AgencyOnboardingAuthority {
  readonly actorId: string;
  readonly authorityId: string;
  readonly grants: readonly AgencyOnboardingGrant[];
}

export class AgencyOnboardingForbiddenError extends Error {
  readonly code = "AGENCY_ONBOARDING_FORBIDDEN";
}

export function authorizeAgencyOnboarding(
  authority: AgencyOnboardingAuthority,
  grant: AgencyOnboardingGrant,
): void {
  if (!authority.grants.includes(grant)) {
    throw new AgencyOnboardingForbiddenError();
  }
}