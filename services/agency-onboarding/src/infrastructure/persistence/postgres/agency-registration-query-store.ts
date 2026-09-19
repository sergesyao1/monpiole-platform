import type { Pool } from "pg";

import type {
  AgencyRegistrationDocument,
  AgencyRegistrationQueryStore,
} from "../../../application/agency-registration-persistence.js";
import {
  type AgencyRegistrationRow,
  toAgencyRegistration,
} from "./agency-registration-mapper.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

const MAX_AGENCY_REGISTRATION_DOCUMENT_SIZE_BYTES =
  50 * 1024 * 1024;

const SELECT_COLUMNS = `
  registration_id,
  status,
  agency_legal_name,
  agency_trade_name,
  registration_number,
  tax_identifier,
  phone,
  email,
  website,
  address,
  city,
  country_code,
  contact_first_name,
  contact_last_name,
  contact_email,
  contact_phone,
  submitted_at,
  review_started_at,
  reviewed_by_identity_id,
  approved_at,
  rejected_at,
  rejection_reason,
  approval_provisioning_started_at,
  provisioned_tenant_id,
  correlation_id,
  created_at,
  updated_at
`;

interface AgencyRegistrationDocumentRow
  extends Record<string, unknown> {
  readonly document_id: string;
  readonly registration_id: string;
  readonly document_type: string;
  readonly storage_key: string;
  readonly original_filename: string;
  readonly mime_type: string;
  readonly size_bytes: string;
  readonly checksum_sha256: string;
  readonly created_at: Date;
}

function toAgencyRegistrationDocument(
  row: AgencyRegistrationDocumentRow,
): AgencyRegistrationDocument {
  return Object.freeze({
    documentId: row.document_id,
    registrationId: row.registration_id,
    documentType: row.document_type,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: parseDocumentSizeBytes(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    createdAt: row.created_at.toISOString(),
  });
}

function parseDocumentSizeBytes(value: string): number {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(
      "Agency registration document size_bytes must be a positive integer",
    );
  }

  const sizeBytes = Number(value);

  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes > MAX_AGENCY_REGISTRATION_DOCUMENT_SIZE_BYTES
  ) {
    throw new Error(
      "Agency registration document size_bytes is outside the supported range",
    );
  }

  return sizeBytes;
}

export class PostgresAgencyRegistrationQueryStore
  implements AgencyRegistrationQueryStore
{
  constructor(private readonly pool: Pool) {}

  findById(registrationId: string) {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows = await scope.query<AgencyRegistrationRow>(
          `SELECT ${SELECT_COLUMNS}
             FROM agency_onboarding.agency_registrations
            WHERE registration_id = $1::uuid
            LIMIT 1`,
          [registrationId],
        );

        const row = rows[0];

        return row === undefined
          ? undefined
          : toAgencyRegistration(row);
      },
    );
  }

  list() {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows = await scope.query<AgencyRegistrationRow>(
          `SELECT ${SELECT_COLUMNS}
             FROM agency_onboarding.agency_registrations
            ORDER BY submitted_at DESC, registration_id DESC`,
        );

        return rows.map(toAgencyRegistration);
      },
    );
  }

  listDocuments(
    registrationId: string,
  ): Promise<readonly AgencyRegistrationDocument[]> {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows =
          await scope.query<AgencyRegistrationDocumentRow>(
            `SELECT
               document_id,
               registration_id,
               document_type,
               storage_key,
               original_filename,
               mime_type,
               size_bytes,
               checksum_sha256,
               created_at
             FROM agency_onboarding.agency_registration_documents
             WHERE registration_id = $1::uuid
             ORDER BY created_at ASC, document_id ASC`,
            [registrationId],
          );

        return Object.freeze(
          rows.map(toAgencyRegistrationDocument),
        );
      },
    );
  }

  findFirstAdministrator(registrationId: string) {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "administrator",
      async (scope) => {
        const rows = await scope.query<{
          internal_identity_id: string;
          status: "PENDING_IDENTITY" | "IDENTITY_LINKED" | "ACTIVE" | "CANCELLED";
          bootstrap_token_expires_at: Date;
        }>(
          `SELECT internal_identity_id, status, bootstrap_token_expires_at
             FROM agency_onboarding.agency_registration_administrators
            WHERE registration_id = $1::uuid
            LIMIT 1`,
          [registrationId],
        );
        const row = rows[0];
        return row === undefined
          ? undefined
          : Object.freeze({
              administratorId: row.internal_identity_id,
              status: row.status,
              bootstrapTokenExpiresAt:
                row.bootstrap_token_expires_at.toISOString(),
            });
      },
    );
  }

  findDocument(
    registrationId: string,
    documentId: string,
  ): Promise<AgencyRegistrationDocument | undefined> {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows =
          await scope.query<AgencyRegistrationDocumentRow>(
            `SELECT
               document_id,
               registration_id,
               document_type,
               storage_key,
               original_filename,
               mime_type,
               size_bytes,
               checksum_sha256,
               created_at
             FROM agency_onboarding.agency_registration_documents
             WHERE registration_id = $1::uuid
               AND document_id = $2::uuid
             LIMIT 1`,
            [registrationId, documentId],
          );

        const row = rows[0];

        return row === undefined
          ? undefined
          : toAgencyRegistrationDocument(row);
      },
    );
  }
}
