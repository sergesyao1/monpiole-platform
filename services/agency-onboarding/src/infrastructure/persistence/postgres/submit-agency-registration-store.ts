import { inArray } from "drizzle-orm";
import type { Pool } from "pg";

import {
  AgencyDocumentStorageKeyConflictError,
  AgencyRegistrationDocumentUploadConsumedError,
  AgencyRegistrationDocumentUploadDuplicateError,
  AgencyRegistrationDocumentUploadExpiredError,
  AgencyRegistrationDocumentUploadNotFoundError,
  AgencyRegistrationNumberConflictError,
} from "../../../application/agency-registration-persistence-errors.js";
import type {
  SubmitAgencyRegistrationInput,
  SubmitAgencyRegistrationStore,
} from "../../../application/agency-registration-persistence.js";
import {
  agencyRegistrationDocuments,
  agencyRegistrationDocumentUploads,
  agencyRegistrations,
} from "./schema.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

interface PostgresError {
  readonly code?: string;
  readonly constraint?: string;
  readonly cause?: unknown;
}

function findPostgresError(
  error: unknown,
): PostgresError | undefined {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);

    const candidate = current as PostgresError;

    if (candidate.code !== undefined) {
      return candidate;
    }

    current = candidate.cause;
  }

  return undefined;
}

function translateAgencySubmissionPersistenceError(error: unknown): never {
  const postgresError = findPostgresError(error);

  if (postgresError?.code === "23505") {
    if (
      postgresError.constraint ===
      "agency_registrations_registration_number_unique"
    ) {
      throw new AgencyRegistrationNumberConflictError();
    }

    if (
      postgresError.constraint ===
      "agency_registration_documents_storage_key_unique"
    ) {
      throw new AgencyDocumentStorageKeyConflictError();
    }
  }

  throw error;
}

export class PostgresSubmitAgencyRegistrationStore
  implements SubmitAgencyRegistrationStore
{
  constructor(private readonly pool: Pool) {}

  async submit(input: SubmitAgencyRegistrationInput): Promise<void> {
    try {
      await withAgencyOnboardingPostgresTransaction(
        this.pool,
        "submit",
        async (scope) => {
          const database = scope.database();
          const registration = input.registration;

          if (registration.status !== "SUBMITTED") {
            throw new Error(
              "Only SUBMITTED agency registrations can be persisted through the public submission store",
            );
          }

          const uploadIds = input.documents.map(
            (document) => document.uploadId,
          );

          if (new Set(uploadIds).size !== uploadIds.length) {
            throw new AgencyRegistrationDocumentUploadDuplicateError();
          }

          const stagedUploads =
            uploadIds.length === 0
              ? []
              : await database
                  .select()
                  .from(agencyRegistrationDocumentUploads)
                  .where(
                    inArray(
                      agencyRegistrationDocumentUploads.uploadId,
                      uploadIds,
                    ),
                  )
                  .for("update");

          if (stagedUploads.length !== uploadIds.length) {
            throw new AgencyRegistrationDocumentUploadNotFoundError();
          }

          const stagedUploadById = new Map(
            stagedUploads.map((upload) => [
              upload.uploadId,
              upload,
            ]),
          );

          for (const uploadId of uploadIds) {
            const upload = stagedUploadById.get(uploadId);

            if (upload === undefined) {
              throw new AgencyRegistrationDocumentUploadNotFoundError();
            }

            if (upload.consumedAt !== null) {
              throw new AgencyRegistrationDocumentUploadConsumedError();
            }

            if (
              new Date(upload.expiresAt).getTime() <=
              new Date(registration.submittedAt).getTime()
            ) {
              throw new AgencyRegistrationDocumentUploadExpiredError();
            }
          }

          await database.insert(agencyRegistrations).values({
            registrationId: registration.id,
            status: registration.status,

            agencyLegalName: registration.agencyLegalName,
            agencyTradeName: registration.agencyTradeName ?? null,
            registrationNumber: registration.registrationNumber,
            taxIdentifier: registration.taxIdentifier ?? null,

            phone: registration.phone,
            email: registration.email,
            website: registration.website ?? null,

            address: registration.address,
            city: registration.city,
            countryCode: registration.countryCode,

            contactFirstName: registration.contactFirstName,
            contactLastName: registration.contactLastName,
            contactEmail: registration.contactEmail,
            contactPhone: registration.contactPhone,

            submittedAt: registration.submittedAt,

            reviewStartedAt: null,
            reviewedByIdentityId: null,
            approvedAt: null,
            rejectedAt: null,
            rejectionReason: null,
            approvalProvisioningStartedAt: null,
            provisionedTenantId: null,

            createdAt: registration.createdAt,
            updatedAt: registration.updatedAt,
            correlationId: registration.correlationId,
          });

          if (input.documents.length > 0) {
            await database.insert(agencyRegistrationDocuments).values(
              input.documents.map((document) => {
                const upload = stagedUploadById.get(document.uploadId);

                if (upload === undefined) {
                  throw new AgencyRegistrationDocumentUploadNotFoundError();
                }

                return {
                  documentId: document.documentId,
                  registrationId: registration.id,
                  documentType: document.documentType,
                  storageKey: upload.storageKey,
                  originalFilename: upload.originalFilename,
                  mimeType: upload.mimeType,
                  sizeBytes: upload.sizeBytes,
                  checksumSha256: upload.checksumSha256,
                  createdAt: upload.createdAt,
                };
              }),
            );

            await database
              .update(agencyRegistrationDocumentUploads)
              .set({
                consumedAt: registration.submittedAt,
              })
              .where(
                inArray(
                  agencyRegistrationDocumentUploads.uploadId,
                  uploadIds,
                ),
              );
          }
        },
      );
    } catch (error) {
      translateAgencySubmissionPersistenceError(error);
    }
  }
}
