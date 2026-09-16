import {
  InvalidAgencyRegistrationTransitionError,
  rejectAgencyRegistration,
  startAgencyRegistrationReview,
  type AgencyRegistration,
} from "../domain/agency-registration.js";
import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  AgencyRegistrationReviewUnitOfWork,
} from "./agency-registration-persistence.js";

export interface AgencyOnboardingClock {
  now(): string;
}

export class AgencyRegistrationNotFoundError extends Error {
  readonly code = "AGENCY_REGISTRATION_NOT_FOUND";
}

export class StartAgencyRegistrationReview {
  public constructor(
    private readonly unitOfWork: AgencyRegistrationReviewUnitOfWork,
    private readonly clock: AgencyOnboardingClock,
  ) {}

  public async execute(command: Readonly<{
    authority: AgencyOnboardingAuthority;
    registrationId: string;
  }>): Promise<AgencyRegistration> {
    authorizeAgencyOnboarding(
      command.authority,
      "REVIEW_AGENCY_REGISTRATIONS",
    );

    return this.unitOfWork.execute(
      "review",
      async (transaction) => {
        const registration =
          await transaction.findForUpdate(command.registrationId);

        if (registration === undefined) {
          throw new AgencyRegistrationNotFoundError();
        }

        const reviewed = startAgencyRegistrationReview(
          registration,
          {
            reviewedByIdentityId: command.authority.actorId,
            occurredAt: this.clock.now(),
          },
        );

        if (reviewed !== registration) {
          await transaction.update(reviewed);
        }

        return reviewed;
      },
    );
  }
}

export class RejectAgencyRegistration {
  public constructor(
    private readonly unitOfWork: AgencyRegistrationReviewUnitOfWork,
    private readonly clock: AgencyOnboardingClock,
  ) {}

  public async execute(command: Readonly<{
    authority: AgencyOnboardingAuthority;
    registrationId: string;
    rejectionReason: string;
  }>): Promise<AgencyRegistration> {
    authorizeAgencyOnboarding(
      command.authority,
      "DECIDE_AGENCY_REGISTRATIONS",
    );

    return this.unitOfWork.execute(
      "decide",
      async (transaction) => {
        const registration =
          await transaction.findForUpdate(command.registrationId);

        if (registration === undefined) {
          throw new AgencyRegistrationNotFoundError();
        }

        const rejected = rejectAgencyRegistration(
          registration,
          {
            rejectionReason: command.rejectionReason,
            occurredAt: this.clock.now(),
          },
        );

        if (rejected !== registration) {
          await transaction.update(rejected);
        }

        return rejected;
      },
    );
  }
}
