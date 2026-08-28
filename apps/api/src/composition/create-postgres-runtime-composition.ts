import { randomUUID } from "node:crypto";

import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  HasActiveTenantAdministrator,
  PostgresIdentityStore,
  PostgresExternalIdentityStore,
} from "@monpiole/identity";
import { PostgresPool, postgresConfigurationFromEnvironment } from "@monpiole/persistence";
import {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, PostgresPropertyOwnerDirectoryQuery,
  PostgresPropertyOwnerRepository, PostgresPropertyPortfolioQuery, PostgresPropertyRepository,
  RetrieveProperty, RetrievePropertyOwner, UpdatePropertyDetails, UpdatePropertyOwner,
  AssignPropertyOwner, PostgresPropertyOwnershipRepository, RetrievePropertyOwnerships, RemovePropertyOwner,
} from "@monpiole/property-management";
import {
  ActivateTenant,
  CheckTenantExists,
  CreateTenant,
  PostgresActivateTenantUnitOfWork,
  PostgresCreateTenantUnitOfWork,
  PostgresTenantExistenceRepository,
} from "@monpiole/tenant-management";

import type { ApiComposition } from "../app.module.js";
import { IdentityActiveTenantAdministratorAdapter } from "./identity-active-tenant-administrator.adapter.js";
import { TenantExistenceAdapter } from "./tenant-existence.adapter.js";
import { OnboardingAuthorityPolicy } from "./onboarding-authority-policy.js";
import { OidcAccessTokenVerifier, oidcAccessTokenConfigurationFromEnvironment } from "../authentication/oidc-access-token-verifier.js";
import { OidcAuthenticatedAuthorityProvider } from "../authentication/oidc-authenticated-authority-provider.js";
import { IdentityExternalAuthorityAdapter } from "./identity-external-authority.adapter.js";

export interface PostgresApiRuntime {
  readonly composition: ApiComposition;
  readonly identityStore: PostgresIdentityStore;
  readonly externalIdentityStore: PostgresExternalIdentityStore;
  close(): Promise<void>;
}

export interface PostgresApiRuntimeDependencies {
  readonly accessTokenVerifier?: Pick<OidcAccessTokenVerifier, "verify">;
}

export function createPostgresApiRuntime(
  environment: NodeJS.ProcessEnv,
  dependencies: PostgresApiRuntimeDependencies = {},
): PostgresApiRuntime {
  const accessTokenVerifier = dependencies.accessTokenVerifier
    ?? new OidcAccessTokenVerifier(oidcAccessTokenConfigurationFromEnvironment(environment));
  const database = new PostgresPool(postgresConfigurationFromEnvironment(environment));
  const pool = database.infrastructurePool();
  const identityStore = new PostgresIdentityStore(pool);
  const externalIdentityStore = new PostgresExternalIdentityStore(pool);
  const authenticatedAuthorityProvider = new OidcAuthenticatedAuthorityProvider(
    accessTokenVerifier,
    new IdentityExternalAuthorityAdapter(externalIdentityStore),
  );
  const activeAdministrator = new HasActiveTenantAdministrator(identityStore);
  const tenantExists = new CheckTenantExists(new PostgresTenantExistenceRepository(pool));
  const authorityPolicy = new OnboardingAuthorityPolicy();
  const propertyRepository = new PostgresPropertyRepository(pool);
  const propertyOwnerRepository = new PostgresPropertyOwnerRepository(pool);
  const propertyOwnershipRepository = new PostgresPropertyOwnershipRepository(pool);

  const composition: ApiComposition = {
    authenticatedAuthorityProvider,
    platformAuthorityAuthorizer: authorityPolicy,
    createTenant: new CreateTenant(
      authorityPolicy,
      new PostgresCreateTenantUnitOfWork(pool),
      { generate: randomUUID }, { generate: randomUUID }, { now: () => new Date().toISOString() },
    ),
    bootstrapTenantAdministrator: new BootstrapTenantAdministrator(
      new TenantExistenceAdapter(tenantExists), identityStore, { generate: randomUUID }, authorityPolicy,
    ),
    activateTenantAdministrator: new ActivateTenantAdministrator(identityStore, authorityPolicy),
    activateTenant: new ActivateTenant(
      new PostgresActivateTenantUnitOfWork(pool),
      new IdentityActiveTenantAdministratorAdapter(activeAdministrator),
      { generate: randomUUID }, { now: () => new Date().toISOString() },
      authorityPolicy,
    ),
    createProperty: new CreateProperty(propertyRepository, { generate: randomUUID }, { now: () => new Date().toISOString() }),
    retrieveProperty: new RetrieveProperty(propertyRepository),
    listProperties: new ListProperties(new PostgresPropertyPortfolioQuery(pool)),
    updatePropertyDetails: new UpdatePropertyDetails(propertyRepository, { now: () => new Date().toISOString() }),
    createPropertyOwner: new CreatePropertyOwner(propertyOwnerRepository, { generate: randomUUID }, { now: () => new Date().toISOString() }),
    retrievePropertyOwner: new RetrievePropertyOwner(propertyOwnerRepository),
    listPropertyOwners: new ListPropertyOwners(new PostgresPropertyOwnerDirectoryQuery(pool)),
    updatePropertyOwner: new UpdatePropertyOwner(propertyOwnerRepository, { now: () => new Date().toISOString() }),
    assignPropertyOwner: new AssignPropertyOwner(propertyOwnershipRepository, { now: () => new Date().toISOString() }),
    retrievePropertyOwnerships: new RetrievePropertyOwnerships(propertyOwnershipRepository),
    removePropertyOwner: new RemovePropertyOwner(propertyOwnershipRepository),
    runtimeShutdown: { onApplicationShutdown: () => database.close() },
  };

  return { composition, identityStore, externalIdentityStore, close: () => database.close() };
}
