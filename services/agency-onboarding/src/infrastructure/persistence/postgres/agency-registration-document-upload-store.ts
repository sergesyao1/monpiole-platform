import type { Pool } from "pg";

import type {
  AgencyRegistrationDocumentUploadStore,
  CreateAgencyRegistrationDocumentUploadInput,
} from "../../../application/agency-registration-document-upload.js";
import { agencyRegistrationDocumentUploads } from "./schema.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

export class PostgresAgencyRegistrationDocumentUploadStore
  implements AgencyRegistrationDocumentUploadStore
{
  constructor(private readonly pool: Pool) {}

  async create(
    input: CreateAgencyRegistrationDocumentUploadInput,
  ): Promise<void> {
    await withAgencyOnboardingPostgresTransaction(
      this.pool,
      "submit",
      async (scope) => {
        const upload = input.upload;

        await scope.database()
          .insert(agencyRegistrationDocumentUploads)
          .values({
            uploadId: upload.uploadId,
            storageKey: upload.storageKey,
            originalFilename: upload.originalFilename,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            checksumSha256: upload.checksumSha256,
            createdAt: upload.createdAt,
            expiresAt: upload.expiresAt,
            consumedAt: upload.consumedAt ?? null,
          });
      },
    );
  }
}