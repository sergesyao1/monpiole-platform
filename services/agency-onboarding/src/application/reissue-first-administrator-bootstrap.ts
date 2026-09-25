import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import {
  calculateFirstAdministratorBootstrapExpiration,
  type FirstAdministratorBootstrapClock,
  type FirstAdministratorBootstrapConfiguration,
  type FirstAdministratorBootstrapTokenGenerator,
  type FirstAdministratorBootstrapTokenHasher,
} from "./first-administrator-bootstrap.js";
import type { FirstAdministratorBootstrapUnitOfWork } from "./first-administrator-persistence.js";

export interface ReissueFirstAdministratorBootstrapCommand {
  readonly registrationId: string;
  readonly correlationId: string;
  readonly authority: AgencyOnboardingAuthority;
}

export interface ReissueFirstAdministratorBootstrapResult {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly status: "PENDING_IDENTITY";
  readonly bootstrapToken: string;
  readonly bootstrapTokenExpiresAt: string;
}

export class FirstAdministratorReissueRegistrationNotFoundError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REISSUE_REGISTRATION_NOT_FOUND";
}

export class FirstAdministratorReissueRegistrationNotReadyError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REISSUE_REGISTRATION_NOT_READY";
}

export class FirstAdministratorReissueAdministratorNotFoundError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REISSUE_ADMINISTRATOR_NOT_FOUND";
}

export class FirstAdministratorReissueNotEligibleError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REISSUE_NOT_ELIGIBLE";
}

export class ReissueFirstAdministratorBootstrap {
  constructor(
    private readonly unitOfWork: FirstAdministratorBootstrapUnitOfWork,
    private readonly tokens: FirstAdministratorBootstrapTokenGenerator,
    private readonly tokenHasher: FirstAdministratorBootstrapTokenHasher,
    private readonly clock: FirstAdministratorBootstrapClock,
    private readonly configuration: FirstAdministratorBootstrapConfiguration,
  ) {}

  async execute(
    command: ReissueFirstAdministratorBootstrapCommand,
  ): Promise<ReissueFirstAdministratorBootstrapResult> {
    authorizeAgencyOnboarding(
      command.authority,
      "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
    );

    return this.unitOfWork.execute(async (transaction) => {
      const registration = await transaction.findRegistrationForUpdate(
        command.registrationId,
      );

      if (!registration) {
        throw new FirstAdministratorReissueRegistrationNotFoundError();
      }

      if (
        registration.status !== "APPROVED" ||
        !registration.provisionedTenantId
      ) {
        throw new FirstAdministratorReissueRegistrationNotReadyError();
      }

      const administrator =
        await transaction.findAdministratorByRegistration(registration.id);

      if (!administrator) {
        throw new FirstAdministratorReissueAdministratorNotFoundError();
      }

      if (
        administrator.tenantId !== registration.provisionedTenantId ||
        administrator.status !== "PENDING_IDENTITY" ||
        administrator.bootstrapTokenConsumedAt !== undefined ||
        administrator.identityLinkedAt !== undefined ||
        administrator.externalIssuer !== undefined ||
        administrator.externalSubject !== undefined
      ) {
        throw new FirstAdministratorReissueNotEligibleError();
      }

      const bootstrapToken = this.tokens.generate();
      const bootstrapTokenHash = this.tokenHasher.hash(bootstrapToken);
      const bootstrapTokenExpiresAt =
        calculateFirstAdministratorBootstrapExpiration(
          this.clock.now(),
          this.configuration.tokenTtlSeconds,
        );

      const rotated =
        await transaction.rotateAdministratorBootstrapToken(
          administrator.registrationId,
          administrator.tenantId,
          administrator.internalIdentityId,
          bootstrapTokenHash,
          bootstrapTokenExpiresAt,
        );

      if (!rotated) {
        throw new FirstAdministratorReissueNotEligibleError();
      }

      return Object.freeze({
        registrationId: rotated.registrationId,
        tenantId: rotated.tenantId,
        administratorId: rotated.internalIdentityId,
        status: "PENDING_IDENTITY" as const,
        bootstrapToken,
        bootstrapTokenExpiresAt: rotated.bootstrapTokenExpiresAt,
      });
    });
  }
}
