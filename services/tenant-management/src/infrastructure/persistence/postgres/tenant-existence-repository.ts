import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";

import type { TenantExistenceRepository } from "../../../application/tenant-existence.js";
import { tenants } from "./schema.js";

export class PostgresTenantExistenceRepository implements TenantExistenceRepository {
  constructor(private readonly pool: Pool) {}

  exists(tenantId: string): Promise<boolean> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      await scope.query("SELECT set_config('app.tenant_capability', 'tenant:exists', true)");
      const row = (await scope.database().select({ id: tenants.id }).from(tenants)
        .where(eq(tenants.id, tenantId)).limit(1))[0];
      return row !== undefined;
    });
  }
}
