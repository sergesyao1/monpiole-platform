import { createHash } from "node:crypto";

import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  AgencyDocumentStorage,
} from "./agency-document-storage.js";
import type {
  AgencyRegistrationDocument,
  AgencyRegistrationQueryStore,
} from "./agency-registration-persistence.js";

export class AgencyRegistrationDocumentContentNotFoundError
  extends Error {
  public readonly code =
    "AGENCY_REGISTRATION_DOCUMENT_CONTENT_NOT_FOUND";

  public constructor(
    registrationId: string,
    documentId: string,
  ) {
    super(
      `Content for agency registration document ${documentId} was not found for registration ${registrationId}`,
    );

    this.name =
      "AgencyRegistrationDocumentContentNotFoundError";
  }
}

export class AgencyRegistrationDocumentIntegrityError
  extends Error {
  public readonly code =
    "AGENCY_REGISTRATION_DOCUMENT_INTEGRITY_ERROR";

  public constructor(
    registrationId: string,
    documentId: string,
  ) {
    super(
      `Integrity verification failed for agency registration document ${documentId} of registration ${registrationId}`,
    );

    this.name =
      "AgencyRegistrationDocumentIntegrityError";
  }
}

export interface AgencyRegistrationDocumentContentResult {
  readonly document: AgencyRegistrationDocument;
  readonly content: Uint8Array;
}

export class RetrieveAgencyRegistrationDocumentContent {
  public constructor(
    private readonly registrations:
      AgencyRegistrationQueryStore,
    private readonly storage:
      AgencyDocumentStorage,
  ) {}

  public async execute(
    input: Readonly<{
      authority: AgencyOnboardingAuthority;
      registrationId: string;
      documentId: string;
    }>,
  ): Promise<AgencyRegistrationDocumentContentResult> {
    authorizeAgencyOnboarding(
      input.authority,
      "RETRIEVE_AGENCY_REGISTRATIONS",
    );

    const document =
      await this.registrations.findDocument(
        input.registrationId,
        input.documentId,
      );

    if (document === undefined) {
      throw new AgencyRegistrationDocumentContentNotFoundError(
        input.registrationId,
        input.documentId,
      );
    }

    const stored =
      await this.storage.retrieve(
        document.storageKey,
      );

    if (stored === undefined) {
      throw new AgencyRegistrationDocumentContentNotFoundError(
        input.registrationId,
        input.documentId,
      );
    }

    if (
      stored.content.byteLength !==
      document.sizeBytes
    ) {
      throw new AgencyRegistrationDocumentIntegrityError(
        input.registrationId,
        input.documentId,
      );
    }

    const checksum = createHash("sha256")
      .update(stored.content)
      .digest("hex");

    if (checksum !== document.checksumSha256) {
      throw new AgencyRegistrationDocumentIntegrityError(
        input.registrationId,
        input.documentId,
      );
    }

    return Object.freeze({
      document,
      content: stored.content,
    });
  }
}