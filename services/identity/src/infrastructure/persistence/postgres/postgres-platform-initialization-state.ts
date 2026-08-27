import { withPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type { PlatformIdentityInitializationState } from "../../../application/platform-initialization-state.js";

export class PostgresPlatformIdentityInitializationState implements PlatformIdentityInitializationState {
  constructor(private readonly pool: Pool) {}

  hasAnyIdentityOrMembership(): Promise<boolean> {
    return withPostgresTransaction(this.pool, async (scope) => {
      await scope.query("SELECT set_config('app.identity_capability', 'platform:initialize:inspect', true)");
      const rows = await scope.query<{ initialized: boolean }>(`SELECT
        EXISTS (SELECT 1 FROM identity.identities)
        OR EXISTS (SELECT 1 FROM identity.tenant_memberships) AS initialized`);
      return rows[0]?.initialized === true;
    });
  }
}
