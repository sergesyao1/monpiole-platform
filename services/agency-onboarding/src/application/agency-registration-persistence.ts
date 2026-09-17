import type { AgencyRegistration } from "../domain/agency-registration.js";

export interface AgencyRegistrationDocument {
  readonly documentId: string;
  readonly registrationId: string;
  readonly documentType: string;
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
}

export interface SubmitAgencyRegistrationDocumentInput {
  readonly documentId: string;
  readonly documentType: string;
  readonly uploadId: string;
}

export interface SubmitAgencyRegistrationInput {
  readonly registration: AgencyRegistration;
  readonly documents: readonly SubmitAgencyRegistrationDocumentInput[];
}

export interface SubmitAgencyRegistrationStore {
  submit(input: SubmitAgencyRegistrationInput): Promise<void>;
}

export interface AgencyRegistrationReviewTransaction {
  findForUpdate(
    registrationId: string,
  ): Promise<AgencyRegistration | undefined>;

  update(
    registration: AgencyRegistration,
  ): Promise<void>;
}

export interface AgencyRegistrationReviewUnitOfWork {
  execute<Result>(
    capability: "review" | "decide",
    operation: (
      transaction: AgencyRegistrationReviewTransaction,
    ) => Promise<Result>,
  ): Promise<Result>;
}

export interface AgencyRegistrationQueryStore {
  findById(
    registrationId: string,
  ): Promise<AgencyRegistration | undefined>;

  list(): Promise<readonly AgencyRegistration[]>;

  listDocuments(
    registrationId: string,
  ): Promise<readonly AgencyRegistrationDocument[]>;

  findDocument(
    registrationId: string,
    documentId: string,
  ): Promise<AgencyRegistrationDocument | undefined>;
}
