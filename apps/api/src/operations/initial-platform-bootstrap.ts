import type {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  PlatformIdentityInitializationState,
} from "@monpiole/identity";
import type {
  ActivateTenant,
  CreateTenant,
  PlatformTenantInitializationState,
} from "@monpiole/tenant-management";

import type { InitialPlatformBootstrapConfiguration } from "./initial-platform-bootstrap-configuration.js";

export interface ExclusiveInitialPlatformBootstrapLock {
  execute<Result>(operation: () => Promise<Result>): Promise<Result>;
}

export interface InitialPlatformBootstrapDependencies {
  readonly lock: ExclusiveInitialPlatformBootstrapLock;
  readonly tenantState: PlatformTenantInitializationState;
  readonly identityState: PlatformIdentityInitializationState;
  readonly createTenant: Pick<CreateTenant, "execute">;
  readonly bootstrapAdministrator: Pick<BootstrapTenantAdministrator, "execute">;
  readonly activateAdministrator: Pick<ActivateTenantAdministrator, "execute">;
  readonly activateTenant: Pick<ActivateTenant, "execute">;
  readonly correlationId: string;
  readonly expectedTenantId: string;
  readonly expectedIdentityId: string;
}

export interface InitialPlatformBootstrapResult {
  readonly tenantId: string;
  readonly tenantLifecycleState: "ACTIVE";
  readonly internalIdentityId: string;
  readonly identityStatus: "ACTIVE";
  readonly role: "TENANT_ADMINISTRATOR";
}

export class PlatformAlreadyInitializedError extends Error {
  readonly code = "PLATFORM_ALREADY_INITIALIZED";
  constructor() { super("Initial platform bootstrap requires an entirely empty platform"); }
}

export class InitialPlatformBootstrapInvariantError extends Error {
  readonly code = "INITIAL_PLATFORM_BOOTSTRAP_INVARIANT";
}

export class InitialPlatformBootstrap {
  constructor(private readonly dependencies: InitialPlatformBootstrapDependencies) {}

  execute(configuration: InitialPlatformBootstrapConfiguration): Promise<InitialPlatformBootstrapResult> {
    return this.dependencies.lock.execute(async () => {
      const [hasTenant, hasIdentity] = await Promise.all([
        this.dependencies.tenantState.hasAnyTenant(),
        this.dependencies.identityState.hasAnyIdentityOrMembership(),
      ]);
      if (hasTenant || hasIdentity) throw new PlatformAlreadyInitializedError();

      const platformAuthority = {
        actorId: configuration.operatorId,
        authorityId: configuration.operatorId,
        grants: ["CREATE_TENANT", "ACTIVATE_TENANT"] as const,
        tenantIds: [this.dependencies.expectedTenantId],
      };
      const tenant = await this.dependencies.createTenant.execute({
        organizationName: configuration.organizationName,
        responsiblePersonName: configuration.responsiblePersonName,
        responsibleEmail: configuration.responsibleEmail,
        responsibleTelephone: configuration.responsibleTelephone,
        country: configuration.country,
        authority: platformAuthority,
        correlationId: this.dependencies.correlationId,
        idempotencyKey: configuration.idempotencyKey,
      });
      if (tenant.tenantId !== this.dependencies.expectedTenantId || tenant.lifecycleState !== "PENDING") {
        throw new InitialPlatformBootstrapInvariantError("Unexpected tenant creation result");
      }

      const identityAuthority = {
        actorId: configuration.operatorId,
        authorityId: configuration.operatorId,
        grants: ["BOOTSTRAP_TENANT_ADMINISTRATOR", "ACTIVATE_TENANT_ADMINISTRATOR"] as const,
        tenantIds: [tenant.tenantId],
      };
      const administrator = await this.dependencies.bootstrapAdministrator.execute({
        tenantId: tenant.tenantId,
        email: configuration.administratorEmail,
        firstName: configuration.administratorFirstName,
        lastName: configuration.administratorLastName,
        correlationId: this.dependencies.correlationId,
        authority: identityAuthority,
      });
      if (administrator.administratorId !== this.dependencies.expectedIdentityId
        || administrator.status !== "PENDING_ACTIVATION"
        || administrator.role !== "TENANT_ADMINISTRATOR") {
        throw new InitialPlatformBootstrapInvariantError("Unexpected administrator bootstrap result");
      }

      const activeAdministrator = await this.dependencies.activateAdministrator.execute({
        tenantId: tenant.tenantId,
        administratorId: administrator.administratorId,
        correlationId: this.dependencies.correlationId,
        authority: identityAuthority,
      });
      if (activeAdministrator.status !== "ACTIVE" || activeAdministrator.role !== "TENANT_ADMINISTRATOR") {
        throw new InitialPlatformBootstrapInvariantError("Unexpected administrator activation result");
      }
      const activeTenant = await this.dependencies.activateTenant.execute({
        tenantId: tenant.tenantId,
        correlationId: this.dependencies.correlationId,
        authority: platformAuthority,
      });
      if (activeTenant.lifecycleState !== "ACTIVE") {
        throw new InitialPlatformBootstrapInvariantError("Unexpected tenant activation result");
      }
      return {
        tenantId: activeTenant.tenantId,
        tenantLifecycleState: "ACTIVE",
        internalIdentityId: activeAdministrator.administratorId,
        identityStatus: "ACTIVE",
        role: "TENANT_ADMINISTRATOR",
      };
    });
  }
}
