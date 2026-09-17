import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  AgencyRegistrationDocument,
  AgencyRegistrationQueryStore,
} from "./agency-registration-persistence.js";

export class AgencyRegistrationDocumentNotFoundError
  extends Error {
  public constructor(
    registrationId: string,
    documentId: string,
  ) {
    super(
      `Agency registration document ${documentId} was not found for registration ${registrationId}`,
    );

    this.name =
      "AgencyRegistrationDocumentNotFoundError";
  }
}

export class RetrieveAgencyRegistrationDocument {
  public constructor(
    private readonly registrations:
      AgencyRegistrationQueryStore,
  ) {}

  public async execute(
    input: Readonly<{
      authority: AgencyOnboardingAuthority;
      registrationId: string;
      documentId: string;
    }>,
  ): Promise<AgencyRegistrationDocument> {
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
      throw new AgencyRegistrationDocumentNotFoundError(
        input.registrationId,
        input.documentId,
      );
    }

    return document;
  }
}