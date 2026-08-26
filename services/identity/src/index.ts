export {
  HasActiveTenantAdministrator,
  type ActiveTenantAdministratorStore,
} from "./application/has-active-tenant-administrator.js";
export {
  ActivateTenantAdministrator,
  TenantAdministratorNotFoundError,
  type ActivateTenantAdministratorCommand,
  type ActivateTenantAdministratorResult,
  type ActivateTenantAdministratorStore,
} from "./application/activate-tenant-administrator.js";
export {
  BootstrapAdministratorConflictError,
  BootstrapTenantAdministrator,
  TenantNotFoundError,
  type BootstrapAdministratorStore,
  type BootstrapTenantAdministratorCommand,
  type BootstrapTenantAdministratorResult,
  type IdentityIdentifierGenerator,
  type TenantExistencePort,
} from "./application/bootstrap-tenant-administrator.js";
export {
  IdentityOnboardingForbiddenError,
  type IdentityOnboardingAuthority,
  type IdentityOnboardingAuthorizer,
  type IdentityOnboardingGrant,
} from "./application/tenant-onboarding-authority.js";
export {
  ExternalIdentity, Identity, InvalidExternalIdentityError, TenantMembership,
  type IdentityStatus, type TenantRole,
} from "./domain/identity.js";
export type {
  ExternalIdentityLinkStore, ExternalIdentityResolver, ResolvedExternalIdentityAuthority,
} from "./application/external-identity-resolution.js";
export { InMemoryBootstrapAdministratorStore } from "./infrastructure/in-memory-bootstrap-administrator-store.js";
export { PostgresIdentityStore } from "./infrastructure/persistence/postgres/postgres-identity-store.js";
export {
  ExternalIdentityAlreadyLinkedError, PostgresExternalIdentityStore,
} from "./infrastructure/persistence/postgres/postgres-external-identity-store.js";
