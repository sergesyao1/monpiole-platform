import { randomUUID } from "node:crypto";

import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  HasActiveTenantAdministrator,
  Identity,
  PostgresIdentityStore,
  PostgresPlatformIdentityInitializationState,
} from "@monpiole/identity";
import { PostgresPool, postgresConfigurationFromEnvironment } from "@monpiole/persistence";
import {
  ActivateTenant,
  CheckTenantExists,
  CreateTenant,
  PostgresActivateTenantUnitOfWork,
  PostgresCreateTenantUnitOfWork,
  PostgresPlatformTenantInitializationState,
  PostgresTenantExistenceRepository,
  Tenant,
} from "@monpiole/tenant-management";

import { OnboardingAuthorityPolicy } from "../composition/onboarding-authority-policy.js";
import { initialPlatformBootstrapConfigurationFromEnvironment } from "./initial-platform-bootstrap-configuration.js";
import { InitialPlatformBootstrap } from "./initial-platform-bootstrap.js";
import { PostgresInitialPlatformBootstrapLock } from "./postgres-initial-platform-bootstrap-lock.js";

const configuration = initialPlatformBootstrapConfigurationFromEnvironment(process.env);
const tenantId = randomUUID();
const internalIdentityId = randomUUID();
const correlationId = randomUUID();
const validationTime = new Date().toISOString();

Tenant.create({
  id: tenantId,
  organizationName: configuration.organizationName,
  responsiblePersonName: configuration.responsiblePersonName,
  responsibleEmail: configuration.responsibleEmail,
  responsibleTelephone: configuration.responsibleTelephone,
  country: configuration.country,
  createdAt: validationTime,
});
Identity.bootstrap({
  id: internalIdentityId,
  email: configuration.administratorEmail,
  firstName: configuration.administratorFirstName,
  lastName: configuration.administratorLastName,
});

const database = new PostgresPool(postgresConfigurationFromEnvironment(process.env));
const pool = database.infrastructurePool();
const identityStore = new PostgresIdentityStore(pool);
const policy = new OnboardingAuthorityPolicy();
const tenantExists = new CheckTenantExists(new PostgresTenantExistenceRepository(pool));
const activeAdministrator = new HasActiveTenantAdministrator(identityStore);

try {
  const result = await new InitialPlatformBootstrap({
    lock: new PostgresInitialPlatformBootstrapLock(pool),
    tenantState: new PostgresPlatformTenantInitializationState(pool),
    identityState: new PostgresPlatformIdentityInitializationState(pool),
    createTenant: new CreateTenant(
      policy,
      new PostgresCreateTenantUnitOfWork(pool),
      { generate: () => tenantId },
      { generate: randomUUID },
      { now: () => new Date().toISOString() },
    ),
    bootstrapAdministrator: new BootstrapTenantAdministrator(
      { exists: (candidateTenantId) => tenantExists.execute(candidateTenantId) },
      identityStore,
      { generate: () => internalIdentityId },
      policy,
    ),
    activateAdministrator: new ActivateTenantAdministrator(identityStore, policy),
    activateTenant: new ActivateTenant(
      new PostgresActivateTenantUnitOfWork(pool),
      { hasActiveTenantAdministrator: (candidateTenantId) => activeAdministrator.execute(candidateTenantId) },
      { generate: randomUUID },
      { now: () => new Date().toISOString() },
      policy,
    ),
    correlationId,
    expectedTenantId: tenantId,
    expectedIdentityId: internalIdentityId,
  }).execute(configuration);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await database.close();
}
