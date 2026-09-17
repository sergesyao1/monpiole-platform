export interface AgencyRegistrationDocumentReference {
  readonly documentType: string;
  readonly uploadId: string;
}

export interface AgencyRegistrationInput {
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
  readonly documents: readonly AgencyRegistrationDocumentReference[];
}

export interface AgencyRegistrationSubmission {
  readonly registrationId: string;
  readonly status: "SUBMITTED";
  readonly submittedAt: string;
}

export interface AgencyRegistrationDocumentUpload {
  readonly uploadId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly expiresAt: string;
}