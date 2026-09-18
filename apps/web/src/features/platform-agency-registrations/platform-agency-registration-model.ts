export type PlatformAgencyRegistrationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface PlatformAgencyRegistration {
  readonly registrationId: string;
  readonly status: PlatformAgencyRegistrationStatus;

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

export interface PlatformAgencyRegistrationDocument {
  readonly documentId: string;
  readonly documentType: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
}

export interface PlatformAgencyRegistrationDetails
  extends PlatformAgencyRegistration {
  readonly documents: readonly PlatformAgencyRegistrationDocument[];
}

export interface PlatformAgencyRegistrationList {
  readonly items: readonly PlatformAgencyRegistration[];
}

export interface RejectPlatformAgencyRegistrationInput {
  readonly rejectionReason: string;
}