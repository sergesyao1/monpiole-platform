import type { AgencyRegistration } from "../domain/agency-registration.js";
import type { AgencyOnboardingAuthority } from "./agency-onboarding-authority.js";

export interface AgencyTenantProvisioningResult {
  readonly tenantId: string;
  readonly lifecycleState: "PENDING";
}

export interface AgencyTenantProvisioningPort {
  provision(input: Readonly<{
    registration: AgencyRegistration;
    authority: AgencyOnboardingAuthority;
    idempotencyKey: string;
  }>): Promise<AgencyTenantProvisioningResult>;
}

export type OrganizationTenantProvisioningResult =
  AgencyTenantProvisioningResult;

export type OrganizationTenantProvisioningPort =
  AgencyTenantProvisioningPort;

export function agencyRegistrationTenantIdempotencyKey(
  registrationId: string,
): string {
  return `agency-registration:${registrationId}`;
}

export function organizationRegistrationTenantIdempotencyKey(
  registrationId: string,
): string {
  return agencyRegistrationTenantIdempotencyKey(registrationId);
}
