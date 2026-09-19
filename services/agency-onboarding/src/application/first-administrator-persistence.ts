import type { AgencyRegistration } from "../domain/agency-registration.js";

export const firstAdministratorStatuses = [
  "PENDING_IDENTITY",
  "IDENTITY_LINKED",
  "ACTIVE",
  "CANCELLED",
] as const;

export type FirstAdministratorStatus =
  (typeof firstAdministratorStatuses)[number];

export interface FirstAdministratorBootstrap {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly internalIdentityId: string;
  readonly administratorKind: "FIRST_ADMINISTRATOR";
  readonly status: FirstAdministratorStatus;
  readonly bootstrapTokenHash: string;
  readonly bootstrapTokenExpiresAt: string;
  readonly bootstrapTokenConsumedAt?: string;
  readonly createdByPlatformIdentityId: string;
  readonly createdAt: string;
  readonly externalIssuer?: string;
  readonly externalSubject?: string;
  readonly identityLinkedAt?: string;
  readonly activatedAt?: string;
  readonly cancelledAt?: string;
}

export interface FirstAdministratorBootstrapTransaction {
  findRegistrationForUpdate(
    registrationId: string,
  ): Promise<AgencyRegistration | undefined>;

  findAdministratorByRegistration(
    registrationId: string,
  ): Promise<FirstAdministratorBootstrap | undefined>;

  findAdministratorByBootstrapTokenHashForUpdate(
    bootstrapTokenHash: string,
  ): Promise<FirstAdministratorBootstrap | undefined>;

  markAdministratorIdentityLinked(
    bootstrapTokenHash: string,
    internalIdentityId: string,
    externalIssuer: string,
    externalSubject: string,
    bootstrapTokenConsumedAt: string,
    identityLinkedAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined>;

  markAdministratorActive(
    registrationId: string,
    tenantId: string,
    internalIdentityId: string,
    activatedAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined>;

  rotateAdministratorBootstrapToken(
    registrationId: string,
    tenantId: string,
    internalIdentityId: string,
    bootstrapTokenHash: string,
    bootstrapTokenExpiresAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined>;

  insertAdministrator(
    administrator: FirstAdministratorBootstrap,
  ): Promise<void>;
}

export interface FirstAdministratorBootstrapUnitOfWork {
  execute<Result>(
    operation: (
      transaction: FirstAdministratorBootstrapTransaction,
    ) => Promise<Result>,
  ): Promise<Result>;
}
