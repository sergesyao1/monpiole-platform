import type { Pool } from "pg";

import {
  AgencyDocumentStorageKeyConflictError,
  AgencyRegistrationNumberConflictError,
} from "../../../application/agency-registration-persistence-errors.js";
import type {
  SubmitAgencyRegistrationInput,
  SubmitAgencyRegistrationStore,
} from "../../../application/agency-registration-persistence.js";
import {
  agencyRegistrationDocuments,
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
              input.documents.map((document) => ({
                documentId: document.documentId,
                registrationId: registration.id,
                documentType: document.documentType,
                storageKey: document.storageKey,
                originalFilename: document.originalFilename,
                mimeType: document.mimeType,
                sizeBytes: document.sizeBytes,
                checksumSha256: document.checksumSha256,
                createdAt: document.createdAt,
              })),
            );
          }
        },
      );
    } catch (error) {
      translateAgencySubmissionPersistenceError(error);
    }
  }
}
