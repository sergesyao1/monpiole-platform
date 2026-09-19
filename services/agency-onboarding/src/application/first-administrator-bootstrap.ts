import {
  authorizeAgencyOnboarding,
  type AgencyOnboardingAuthority,
} from "./agency-onboarding-authority.js";
import type {
  FirstAdministratorBootstrap,
  FirstAdministratorBootstrapUnitOfWork,
} from "./first-administrator-persistence.js";

export interface ProvisionFirstAdministratorIdentityInput {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly correlationId: string;
  readonly requestedByPlatformIdentityId: string;
}

export interface ProvisionFirstAdministratorIdentityResult {
  readonly tenantId: string;
  readonly administratorId: string;
  readonly email: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "PENDING_ACTIVATION";
}

export interface FirstAdministratorIdentityProvisioningPort {
  /**
   * Must converge for the same registration/tenant bootstrap.
   *
   * If the identity was created during an earlier attempt whose onboarding
   * persistence did not complete, the adapter must return that same identity.
   * An unrelated existing identity or tenant membership remains a conflict.
   */
  provision(
    input: ProvisionFirstAdministratorIdentityInput,
  ): Promise<ProvisionFirstAdministratorIdentityResult>;
}

export interface FirstAdministratorBootstrapTokenGenerator {
  generate(): string;
}

export interface FirstAdministratorBootstrapTokenHasher {
  hash(token: string): string;
}

export interface FirstAdministratorBootstrapClock {
  now(): string;
}

export interface FirstAdministratorBootstrapConfiguration {
  readonly tokenTtlSeconds: number;
}

export interface CreateFirstAgencyAdministratorCommand {
  readonly registrationId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly correlationId: string;
  readonly authority: AgencyOnboardingAuthority;
}

export interface CreateFirstAgencyAdministratorResult {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "PENDING_IDENTITY";
  readonly bootstrapToken?: string;
  readonly bootstrapTokenExpiresAt: string;
}

export class FirstAdministratorRegistrationNotFoundError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REGISTRATION_NOT_FOUND";
}

export class FirstAdministratorRegistrationNotReadyError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_REGISTRATION_NOT_READY";
}

export class FirstAdministratorAlreadyExistsError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_ALREADY_EXISTS";
}

export class InvalidFirstAdministratorBootstrapConfigurationError extends Error {
  readonly code = "INVALID_FIRST_ADMINISTRATOR_BOOTSTRAP_CONFIGURATION";
}

export function calculateFirstAdministratorBootstrapExpiration(
  isoTimestamp: string,
  seconds: number,
): string {
  const timestamp = new Date(isoTimestamp);

  if (
    Number.isNaN(timestamp.getTime()) ||
    !Number.isInteger(seconds) ||
    seconds <= 0
  ) {
    throw new InvalidFirstAdministratorBootstrapConfigurationError();
  }

  return new Date(timestamp.getTime() + seconds * 1000).toISOString();
}

export class CreateFirstAgencyAdministrator {
  constructor(
    private readonly unitOfWork: FirstAdministratorBootstrapUnitOfWork,
    private readonly identities: FirstAdministratorIdentityProvisioningPort,
    private readonly tokens: FirstAdministratorBootstrapTokenGenerator,
    private readonly tokenHasher: FirstAdministratorBootstrapTokenHasher,
    private readonly clock: FirstAdministratorBootstrapClock,
    private readonly configuration: FirstAdministratorBootstrapConfiguration,
  ) {}

  async execute(
    command: CreateFirstAgencyAdministratorCommand,
  ): Promise<CreateFirstAgencyAdministratorResult> {
    authorizeAgencyOnboarding(
      command.authority,
      "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
    );

    const prepared = await this.unitOfWork.execute(async (transaction) => {
      const registration = await transaction.findRegistrationForUpdate(
        command.registrationId,
      );

      if (!registration) {
        throw new FirstAdministratorRegistrationNotFoundError();
      }

      if (
        registration.status !== "APPROVED" ||
        !registration.provisionedTenantId
      ) {
        throw new FirstAdministratorRegistrationNotReadyError();
      }

      const existing =
        await transaction.findAdministratorByRegistration(registration.id);

      if (existing) {
        return {
          kind: "EXISTING" as const,
          administrator: existing,
        };
      }

      return {
        kind: "PROVISION" as const,
        registrationId: registration.id,
        tenantId: registration.provisionedTenantId,
      };
    });

    if (prepared.kind === "EXISTING") {
      const existing = prepared.administrator;

      if (existing.status !== "PENDING_IDENTITY") {
        throw new FirstAdministratorAlreadyExistsError();
      }

      return Object.freeze({
        registrationId: existing.registrationId,
        tenantId: existing.tenantId,
        administratorId: existing.internalIdentityId,
        role: "TENANT_ADMINISTRATOR",
        status: "PENDING_IDENTITY",
        bootstrapTokenExpiresAt: existing.bootstrapTokenExpiresAt,
      });
    }

    const identity = await this.identities.provision({
      registrationId: prepared.registrationId,
      tenantId: prepared.tenantId,
      email: command.email,
      firstName: command.firstName,
      lastName: command.lastName,
      correlationId: command.correlationId,
      requestedByPlatformIdentityId: command.authority.actorId,
    });

    if (
      identity.tenantId !== prepared.tenantId ||
      identity.role !== "TENANT_ADMINISTRATOR" ||
      identity.status !== "PENDING_ACTIVATION" ||
      identity.administratorId.trim().length === 0
    ) {
      throw new FirstAdministratorAlreadyExistsError();
    }

    const token = this.tokens.generate();
    const tokenHash = this.tokenHasher.hash(token);
    const createdAt = this.clock.now();
    const expiresAt = calculateFirstAdministratorBootstrapExpiration(
      createdAt,
      this.configuration.tokenTtlSeconds,
    );

    const administrator: FirstAdministratorBootstrap = Object.freeze({
      registrationId: prepared.registrationId,
      tenantId: prepared.tenantId,
      internalIdentityId: identity.administratorId,
      administratorKind: "FIRST_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrapTokenHash: tokenHash,
      bootstrapTokenExpiresAt: expiresAt,
      createdByPlatformIdentityId: command.authority.actorId,
      createdAt,
    });

    const persisted = await this.unitOfWork.execute(async (transaction) => {
      const registration = await transaction.findRegistrationForUpdate(
        prepared.registrationId,
      );

      if (
        !registration ||
        registration.status !== "APPROVED" ||
        registration.provisionedTenantId !== prepared.tenantId
      ) {
        throw new FirstAdministratorRegistrationNotReadyError();
      }

      const existing =
        await transaction.findAdministratorByRegistration(
          prepared.registrationId,
        );

      if (existing) {
        return {
          created: false as const,
          administrator: existing,
        };
      }

      await transaction.insertAdministrator(administrator);

      return {
        created: true as const,
        administrator,
      };
    });

    if (!persisted.created) {
      const existing = persisted.administrator;

      if (
        existing.status !== "PENDING_IDENTITY" ||
        existing.internalIdentityId !== identity.administratorId
      ) {
        throw new FirstAdministratorAlreadyExistsError();
      }

      return Object.freeze({
        registrationId: existing.registrationId,
        tenantId: existing.tenantId,
        administratorId: existing.internalIdentityId,
        role: "TENANT_ADMINISTRATOR",
        status: "PENDING_IDENTITY",
        bootstrapTokenExpiresAt: existing.bootstrapTokenExpiresAt,
      });
    }

    return Object.freeze({
      registrationId: administrator.registrationId,
      tenantId: administrator.tenantId,
      administratorId: administrator.internalIdentityId,
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrapToken: token,
      bootstrapTokenExpiresAt: administrator.bootstrapTokenExpiresAt,
    });
  }
}
