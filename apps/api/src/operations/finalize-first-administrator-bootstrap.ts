import type {
  CompleteFirstAdministratorIdentity,
  FinalizeFirstAdministratorActivation,
} from "@monpiole/agency-onboarding";
import type {
  ActivateTenantAdministrator,
  IdentityOnboardingAuthority,
} from "@monpiole/identity";
import type {
  ActivateTenant,
  PlatformAuthority,
} from "@monpiole/tenant-management";

const SYSTEM_AUTHORITY_ID =
  "system:agency-first-administrator-finalization";

export interface FinalizationCorrelationIdGenerator {
  generate(): string;
}

export interface FinalizeFirstAdministratorBootstrapDependencies {
  readonly completeIdentity: Pick<
    CompleteFirstAdministratorIdentity,
    "execute"
  >;
  readonly activateAdministrator: Pick<
    ActivateTenantAdministrator,
    "execute"
  >;
  readonly activateTenant: Pick<ActivateTenant, "execute">;
  readonly finalizeActivation: Pick<
    FinalizeFirstAdministratorActivation,
    "execute"
  >;
  readonly correlationIds: FinalizationCorrelationIdGenerator;
}

export interface FinalizeFirstAdministratorBootstrapCommand {
  readonly bootstrapToken: string;
  readonly issuer: string;
  readonly subject: string;
  readonly email?: string;
  readonly emailVerified: boolean;
}

export interface FinalizeFirstAdministratorBootstrapResult {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "ACTIVE";
  readonly identityLinkedAt: string;
  readonly activatedAt: string;
}

export class FirstAdministratorFinalizationInvariantError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_FINALIZATION_INVARIANT";

  constructor(message: string) {
    super(message);
    this.name = "FirstAdministratorFinalizationInvariantError";
  }
}

export class FinalizeFirstAdministratorBootstrap {
  constructor(
    private readonly dependencies:
      FinalizeFirstAdministratorBootstrapDependencies,
  ) {}

  async execute(
    command: FinalizeFirstAdministratorBootstrapCommand,
  ): Promise<FinalizeFirstAdministratorBootstrapResult> {
    const linked = await this.dependencies.completeIdentity.execute({
      bootstrapToken: command.bootstrapToken,
      issuer: command.issuer,
      subject: command.subject,
      ...(command.email === undefined ? {} : { email: command.email }),
      emailVerified: command.emailVerified,
    });

    const correlationId = this.dependencies.correlationIds.generate();

    const identityAuthority: IdentityOnboardingAuthority = {
      actorId: SYSTEM_AUTHORITY_ID,
      authorityId: SYSTEM_AUTHORITY_ID,
      grants: ["ACTIVATE_TENANT_ADMINISTRATOR"],
      tenantIds: [linked.tenantId],
    };

    const platformAuthority: PlatformAuthority = {
      actorId: SYSTEM_AUTHORITY_ID,
      authorityId: SYSTEM_AUTHORITY_ID,
      grants: ["ACTIVATE_TENANT"],
      tenantIds: [linked.tenantId],
    };

    const activeAdministrator =
      await this.dependencies.activateAdministrator.execute({
        tenantId: linked.tenantId,
        administratorId: linked.administratorId,
        correlationId,
        authority: identityAuthority,
      });

    if (
      activeAdministrator.tenantId !== linked.tenantId ||
      activeAdministrator.administratorId !== linked.administratorId ||
      activeAdministrator.role !== "TENANT_ADMINISTRATOR" ||
      activeAdministrator.status !== "ACTIVE"
    ) {
      throw new FirstAdministratorFinalizationInvariantError(
        "Unexpected first administrator activation result",
      );
    }

    const activeTenant = await this.dependencies.activateTenant.execute({
      tenantId: linked.tenantId,
      correlationId,
      authority: platformAuthority,
    });

    if (
      activeTenant.tenantId !== linked.tenantId ||
      activeTenant.lifecycleState !== "ACTIVE"
    ) {
      throw new FirstAdministratorFinalizationInvariantError(
        "Unexpected tenant activation result",
      );
    }

    const finalized =
      await this.dependencies.finalizeActivation.execute({
        registrationId: linked.registrationId,
        tenantId: linked.tenantId,
        administratorId: linked.administratorId,
      });

    if (
      finalized.registrationId !== linked.registrationId ||
      finalized.tenantId !== linked.tenantId ||
      finalized.administratorId !== linked.administratorId ||
      finalized.role !== "TENANT_ADMINISTRATOR" ||
      finalized.status !== "ACTIVE"
    ) {
      throw new FirstAdministratorFinalizationInvariantError(
        "Unexpected first administrator finalization result",
      );
    }

    return Object.freeze({
      registrationId: finalized.registrationId,
      tenantId: finalized.tenantId,
      administratorId: finalized.administratorId,
      role: finalized.role,
      status: "ACTIVE",
      identityLinkedAt: linked.identityLinkedAt,
      activatedAt: finalized.activatedAt,
    });
  }
}
