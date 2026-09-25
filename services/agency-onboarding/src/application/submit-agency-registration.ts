import type {
  AgencyRegistration,
} from "../domain/agency-registration.js";
import type {
  SubmitAgencyRegistrationStore,
} from "./agency-registration-persistence.js";

export interface AgencyOnboardingIdGenerator {
  generate(): string;
}

export interface SubmitAgencyRegistrationCommand {
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

  readonly documents: readonly Readonly<{
    documentType: string;
    uploadId: string;
  }>[];

  readonly correlationId: string;
}

export interface SubmitAgencyRegistrationResult {
  readonly registration: AgencyRegistration;
}

export interface AgencySubmissionClock {
  now(): string;
}

export class SubmitAgencyRegistration {
  public constructor(
    private readonly store: SubmitAgencyRegistrationStore,
    private readonly clock: AgencySubmissionClock,
    private readonly ids: AgencyOnboardingIdGenerator,
  ) {}

  public async execute(
    command: SubmitAgencyRegistrationCommand,
  ): Promise<SubmitAgencyRegistrationResult> {
    const occurredAt = this.clock.now();
    const registrationId = this.ids.generate();

    const registration: AgencyRegistration = Object.freeze({
      id: registrationId,
      status: "SUBMITTED",

      agencyLegalName: command.agencyLegalName,
      ...(command.agencyTradeName === undefined
        ? {}
        : { agencyTradeName: command.agencyTradeName }),
      registrationNumber: command.registrationNumber,
      ...(command.taxIdentifier === undefined
        ? {}
        : { taxIdentifier: command.taxIdentifier }),

      phone: command.phone,
      email: command.email,
      ...(command.website === undefined
        ? {}
        : { website: command.website }),

      address: command.address,
      city: command.city,
      countryCode: command.countryCode,

      contactFirstName: command.contactFirstName,
      contactLastName: command.contactLastName,
      contactEmail: command.contactEmail,
      contactPhone: command.contactPhone,

      submittedAt: occurredAt,
      correlationId: command.correlationId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });

    const documents = Object.freeze(
      command.documents.map((document) =>
        Object.freeze({
          documentId: this.ids.generate(),
          documentType: document.documentType,
          uploadId: document.uploadId,
        }),
      ),
    );

    await this.store.submit({
      registration,
      documents,
    });

    return Object.freeze({
      registration,
    });
  }
}
