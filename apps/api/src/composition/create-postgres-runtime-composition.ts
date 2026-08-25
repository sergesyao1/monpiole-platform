import { randomUUID } from "node:crypto";

import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  HasActiveTenantAdministrator,
  PostgresIdentityStore,
} from "@monpiole/identity";
import { PostgresPool, postgresConfigurationFromEnvironment } from "@monpiole/persistence";
import {
  ActivateTenant,
  CheckTenantExists,
  PostgresActivateTenantUnitOfWork,
  PostgresTenantExistenceRepository,
} from "@monpiole/tenant-management";

import type { ApiComposition } from "../app.module.js";
import { IdentityActiveTenantAdministratorAdapter } from "./identity-active-tenant-administrator.adapter.js";
import { TenantExistenceAdapter } from "./tenant-existence.adapter.js";

export interface PostgresApiRuntime {
  readonly composition: ApiComposition;
  readonly identityStore: PostgresIdentityStore;
  close(): Promise<void>;
}

export function createPostgresApiRuntime(environment: NodeJS.ProcessEnv): PostgresApiRuntime {
  const database = new PostgresPool(postgresConfigurationFromEnvironment(environment));
  const pool = database.infrastructurePool();
  const identityStore = new PostgresIdentityStore(pool);
  const activeAdministrator = new HasActiveTenantAdministrator(identityStore);
  const tenantExists = new CheckTenantExists(new PostgresTenantExistenceRepository(pool));

  const composition: ApiComposition = {
    bootstrapTenantAdministrator: new BootstrapTenantAdministrator(
      new TenantExistenceAdapter(tenantExists), identityStore, { generate: randomUUID },
    ),
    activateTenantAdministrator: new ActivateTenantAdministrator(identityStore),
    activateTenant: new ActivateTenant(
      new PostgresActivateTenantUnitOfWork(pool),
      new IdentityActiveTenantAdministratorAdapter(activeAdministrator),
      { generate: randomUUID }, { now: () => new Date().toISOString() },
    ),
    runtimeShutdown: { onApplicationShutdown: () => database.close() },
  };

  return { composition, identityStore, close: () => database.close() };
}
