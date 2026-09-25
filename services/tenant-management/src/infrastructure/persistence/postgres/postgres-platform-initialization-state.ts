import { withPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type { PlatformTenantInitializationState } from "../../../application/platform-initialization-state.js";

export class PostgresPlatformTenantInitializationState implements PlatformTenantInitializationState {
  constructor(private readonly pool: Pool) {}

  hasAnyTenant(): Promise<boolean> {
    return withPostgresTransaction(this.pool, async (scope) => {
      await scope.query("SELECT set_config('app.platform_authority', 'tenant:create', true)");
      const rows = await scope.query<{ initialized: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM tenant_management.tenants) AS initialized",
      );
      return rows[0]?.initialized === true;
    });
  }
}
