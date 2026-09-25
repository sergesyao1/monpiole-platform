import type {
  AgencyRegistration,
} from "../domain/agency-registration.js";
import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  AgencyRegistrationDocument,
  AgencyRegistrationQueryStore,
} from "./agency-registration-persistence.js";
import {
  AgencyRegistrationNotFoundError,
} from "./review-agency-registration.js";

export interface AgencyRegistrationDetails {
  readonly registration: AgencyRegistration;
  readonly documents: readonly AgencyRegistrationDocument[];
  readonly firstAdministrator?: Readonly<{
    administratorId: string;
    status: "PENDING_IDENTITY" | "IDENTITY_LINKED" | "ACTIVE" | "CANCELLED";
    bootstrapTokenExpiresAt: string;
  }>;
}

export class ListAgencyRegistrations {
  public constructor(
    private readonly registrations: AgencyRegistrationQueryStore,
  ) {}

  public async execute(
    input: Readonly<{
      authority: AgencyOnboardingAuthority;
    }>,
  ): Promise<readonly AgencyRegistration[]> {
    authorizeAgencyOnboarding(
      input.authority,
      "RETRIEVE_AGENCY_REGISTRATIONS",
    );

    return this.registrations.list();
  }
}

export class RetrieveAgencyRegistration {
  public constructor(
    private readonly registrations: AgencyRegistrationQueryStore,
  ) {}

  public async execute(
    input: Readonly<{
      registrationId: string;
      authority: AgencyOnboardingAuthority;
    }>,
  ): Promise<AgencyRegistrationDetails> {
    authorizeAgencyOnboarding(
      input.authority,
      "RETRIEVE_AGENCY_REGISTRATIONS",
    );

    const registration = await this.registrations.findById(
      input.registrationId,
    );

    if (registration === undefined) {
      throw new AgencyRegistrationNotFoundError(
        input.registrationId,
      );
    }

    const documents = await this.registrations.listDocuments(
      input.registrationId,
    );
    const firstAdministrator =
      await this.registrations.findFirstAdministrator(input.registrationId);

    return Object.freeze({
      registration,
      documents,
      ...(firstAdministrator === undefined ? {} : { firstAdministrator }),
    });
  }
}
