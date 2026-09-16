export const agencyRegistrationStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

export type AgencyRegistrationStatus =
  (typeof agencyRegistrationStatuses)[number];

export interface AgencyRegistration {
  readonly id: string;
  readonly status: AgencyRegistrationStatus;

  readonly agencyLegalName: string;
  readonly agencyTradeName?: string;
  readonly registrationNumber: string;
  readonly taxIdentifier?: string;

  readonly phone: string;
  readonly email: string;
  readonly website?: string;

  readonly address: string;
  readonly city: string;
  readonly countryCode: string;

  readonly contactFirstName: string;
  readonly contactLastName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;

  readonly submittedAt: string;
  readonly reviewStartedAt?: string;
  readonly reviewedByIdentityId?: string;

  readonly approvedAt?: string;
  readonly rejectedAt?: string;
  readonly rejectionReason?: string;

  readonly approvalProvisioningStartedAt?: string;
  readonly provisionedTenantId?: string;

  readonly correlationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class InvalidAgencyRegistrationTransitionError extends Error {
  readonly code = "INVALID_AGENCY_REGISTRATION_TRANSITION";
}

export function startAgencyRegistrationReview(
  registration: AgencyRegistration,
  input: Readonly<{
    reviewedByIdentityId: string;
    occurredAt: string;
  }>,
): AgencyRegistration {
  if (registration.status === "UNDER_REVIEW") {
    if (
      registration.reviewedByIdentityId === input.reviewedByIdentityId
    ) {
      return registration;
    }

    throw new InvalidAgencyRegistrationTransitionError();
  }

  if (registration.status !== "SUBMITTED") {
    throw new InvalidAgencyRegistrationTransitionError();
  }

  return Object.freeze({
    ...registration,
    status: "UNDER_REVIEW",
    reviewStartedAt: input.occurredAt,
    reviewedByIdentityId: input.reviewedByIdentityId,
    updatedAt: input.occurredAt,
  });
}

export function rejectAgencyRegistration(
  registration: AgencyRegistration,
  input: Readonly<{
    rejectionReason: string;
    occurredAt: string;
  }>,
): AgencyRegistration {
  const reason = input.rejectionReason.trim();

  if (reason.length === 0) {
    throw new InvalidAgencyRegistrationTransitionError();
  }

  if (registration.status === "REJECTED") {
    if (registration.rejectionReason === reason) {
      return registration;
    }

    throw new InvalidAgencyRegistrationTransitionError();
  }

  if (
    registration.status !== "UNDER_REVIEW" ||
    registration.approvalProvisioningStartedAt !== undefined
  ) {
    throw new InvalidAgencyRegistrationTransitionError();
  }

  return Object.freeze({
    ...registration,
    status: "REJECTED",
    rejectedAt: input.occurredAt,
    rejectionReason: reason,
    updatedAt: input.occurredAt,
  });
}
export function startAgencyRegistrationApprovalProvisioning(
  registration: AgencyRegistration,
  input: Readonly<{
    occurredAt: string;
  }>,
): AgencyRegistration {
  if (registration.status !== "UNDER_REVIEW") {
    throw new InvalidAgencyRegistrationTransitionError();
  }

  if (
    registration.approvalProvisioningStartedAt !== undefined
  ) {
    return registration;
  }

  return Object.freeze({
    ...registration,
    approvalProvisioningStartedAt: input.occurredAt,
    updatedAt: input.occurredAt,
  });
}

export function approveAgencyRegistration(
  registration: AgencyRegistration,
  input: Readonly<{
    provisionedTenantId: string;
    occurredAt: string;
  }>,
): AgencyRegistration {
  if (registration.status === "APPROVED") {
    if (
      registration.provisionedTenantId ===
      input.provisionedTenantId
    ) {
      return registration;
    }

    throw new InvalidAgencyRegistrationTransitionError();
  }

  if (
    registration.status !== "UNDER_REVIEW" ||
    registration.approvalProvisioningStartedAt === undefined
  ) {
    throw new InvalidAgencyRegistrationTransitionError();
  }

  return Object.freeze({
    ...registration,
    status: "APPROVED",
    approvedAt: input.occurredAt,
    provisionedTenantId: input.provisionedTenantId,
    updatedAt: input.occurredAt,
  });
}