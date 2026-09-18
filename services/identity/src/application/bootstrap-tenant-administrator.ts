import { Identity, TenantMembership, normalizeAdministratorEmail } from "../domain/identity.js";
import {
  IdentityOnboardingForbiddenError,
  type IdentityOnboardingAuthority,
  type IdentityOnboardingAuthorizer,
} from "./tenant-onboarding-authority.js";

export interface BootstrapTenantAdministratorCommand {
  readonly tenantId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly correlationId: string;
  readonly authority: IdentityOnboardingAuthority;
}

export interface BootstrapTenantAdministratorResult {
  readonly tenantId: string;
  readonly administratorId: string;
  readonly email: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "PENDING_ACTIVATION";
}

export interface BootstrapAdministratorReplay {
  readonly identity: Identity;
  readonly membership: TenantMembership;
}

export interface TenantExistencePort {
  exists(tenantId: string): Promise<boolean>;
}

export interface IdentityIdentifierGenerator {
  generate(): string;
}

export interface BootstrapAdministratorStore {
  findBootstrapByCorrelation(
    correlationId: string,
    tenantId: string,
  ): Promise<BootstrapAdministratorReplay | undefined>;

  findIdentityByEmail(
    normalizedEmail: string,
    tenantId: string,
  ): Promise<Identity | undefined>;

  findMembership(tenantId: string): Promise<TenantMembership | undefined>;

  saveAtomically(
    identity: Identity,
    membership: TenantMembership,
    correlationId: string,
  ): Promise<void>;
}

export class TenantNotFoundError extends Error {
  readonly code = "BOOTSTRAP_TENANT_NOT_FOUND";
}

export class BootstrapAdministratorConflictError extends Error {
  readonly code = "BOOTSTRAP_ADMINISTRATOR_CONFLICT";
}

export class BootstrapTenantAdministrator {
  constructor(
    private readonly tenants: TenantExistencePort,
    private readonly store: BootstrapAdministratorStore,
    private readonly identifiers: IdentityIdentifierGenerator,
    private readonly authorizer: IdentityOnboardingAuthorizer,
  ) {}

  async execute(
    command: BootstrapTenantAdministratorCommand,
  ): Promise<BootstrapTenantAdministratorResult> {
    if (
      !await this.authorizer.authorize(
        command.authority,
        "BOOTSTRAP_TENANT_ADMINISTRATOR",
        command.tenantId,
      )
    ) {
      throw new IdentityOnboardingForbiddenError();
    }

    if (!await this.tenants.exists(command.tenantId)) {
      throw new TenantNotFoundError();
    }

    const email = normalizeAdministratorEmail(command.email);

    const replay = await this.store.findBootstrapByCorrelation(
      command.correlationId,
      command.tenantId,
    );

    if (replay !== undefined) {
      return this.replayResult(replay, command.tenantId, email);
    }

    if (
      await this.store.findIdentityByEmail(email, command.tenantId) ||
      await this.store.findMembership(command.tenantId)
    ) {
      throw new BootstrapAdministratorConflictError();
    }

    const identity = Identity.bootstrap({
      id: this.identifiers.generate(),
      email,
      firstName: command.firstName,
      lastName: command.lastName,
    });

    const membership = TenantMembership.bootstrap(
      command.tenantId,
      identity.id,
    );

    try {
      await this.store.saveAtomically(
        identity,
        membership,
        command.correlationId,
      );
    } catch (error) {
      if (!(error instanceof BootstrapAdministratorConflictError)) {
        throw error;
      }

      const concurrentReplay = await this.store.findBootstrapByCorrelation(
        command.correlationId,
        command.tenantId,
      );

      if (concurrentReplay === undefined) {
        throw error;
      }

      return this.replayResult(
        concurrentReplay,
        command.tenantId,
        email,
      );
    }

    return Object.freeze({
      tenantId: membership.tenantId,
      administratorId: identity.id,
      email: identity.email,
      role: membership.role,
      status: identity.status,
    });
  }

  private replayResult(
    replay: BootstrapAdministratorReplay,
    tenantId: string,
    email: string,
  ): BootstrapTenantAdministratorResult {
    if (
      replay.membership.tenantId !== tenantId ||
      replay.membership.identityId !== replay.identity.id ||
      replay.identity.email !== email ||
      replay.identity.status !== "PENDING_ACTIVATION" ||
      replay.membership.role !== "TENANT_ADMINISTRATOR"
    ) {
      throw new BootstrapAdministratorConflictError();
    }

    return Object.freeze({
      tenantId: replay.membership.tenantId,
      administratorId: replay.identity.id,
      email: replay.identity.email,
      role: replay.membership.role,
      status: replay.identity.status,
    });
  }
}
