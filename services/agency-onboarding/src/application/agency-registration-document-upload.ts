export interface AgencyRegistrationDocumentUpload {
  readonly uploadId: string;
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt?: string;
}

export interface CreateAgencyRegistrationDocumentUploadInput {
  readonly upload: AgencyRegistrationDocumentUpload;
}

export interface AgencyRegistrationDocumentUploadStore {
  create(
    input: CreateAgencyRegistrationDocumentUploadInput,
  ): Promise<void>;
}