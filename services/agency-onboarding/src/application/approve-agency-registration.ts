import {
  approveAgencyRegistration,
  InvalidAgencyRegistrationTransitionError,
  startAgencyRegistrationApprovalProvisioning,
  type AgencyRegistration,
} from "../domain/agency-registration.js";
import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  AgencyRegistrationReviewUnitOfWork,
} from "./agency-registration-persistence.js";
import {
  agencyRegistrationTenantIdempotencyKey,
  type AgencyTenantProvisioningPort,
} from "./agency-tenant-provisioning.js";
import {
  AgencyRegistrationNotFoundError,
  type AgencyOnboardingClock,
} from "./review-agency-registration.js";

export class ApproveAgencyRegistration {
  public constructor(
    private readonly unitOfWork: AgencyRegistrationReviewUnitOfWork,
    private readonly tenantProvisioning: AgencyTenantProvisioningPort,
    private readonly clock: AgencyOnboardingClock,
  ) {}

  public async execute(command: Readonly<{
    authority: AgencyOnboardingAuthority;
    registrationId: string;
  }>): Promise<AgencyRegistration> {
    authorizeAgencyOnboarding(
      command.authority,
      "DECIDE_AGENCY_REGISTRATIONS",
    );

    const registration = await this.unitOfWork.execute(
      "decide",
      async (transaction) => {
        const locked =
          await transaction.findForUpdate(command.registrationId);

        if (locked === undefined) {
          throw new AgencyRegistrationNotFoundError();
        }

        if (locked.status === "APPROVED") {
          return locked;
        }

        if (locked.status !== "UNDER_REVIEW") {
          throw new InvalidAgencyRegistrationTransitionError();
        }

        const claimed =
          startAgencyRegistrationApprovalProvisioning(
            locked,
            {
              occurredAt: this.clock.now(),
            },
          );

        if (claimed !== locked) {
          await transaction.update(claimed);
        }

        return claimed;
      },
    );

    if (
      registration.status === "APPROVED" &&
      registration.provisionedTenantId !== undefined
    ) {
      return registration;
    }

    const provisioned =
      await this.tenantProvisioning.provision({
        registration,
        authority: command.authority,
        idempotencyKey:
          agencyRegistrationTenantIdempotencyKey(
            registration.id,
          ),
      });

    if (provisioned.lifecycleState !== "PENDING") {
      throw new Error(
        "Agency tenant provisioning must return a pending tenant.",
      );
    }

    return this.unitOfWork.execute(
      "decide",
      async (transaction) => {
        const locked =
          await transaction.findForUpdate(command.registrationId);

        if (locked === undefined) {
          throw new AgencyRegistrationNotFoundError();
        }

        const approved = approveAgencyRegistration(
          locked,
          {
            provisionedTenantId: provisioned.tenantId,
            occurredAt: this.clock.now(),
          },
        );

        if (approved !== locked) {
          await transaction.update(approved);
        }

        return approved;
      },
    );
  }
}