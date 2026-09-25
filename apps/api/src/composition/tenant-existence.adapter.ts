import type { TenantExistencePort } from "@monpiole/identity";
import type { CheckTenantExists } from "@monpiole/tenant-management";

export class TenantExistenceAdapter implements TenantExistencePort {
  constructor(private readonly query: Pick<CheckTenantExists, "execute">) {}

  exists(tenantId: string): Promise<boolean> {
    return this.query.execute(tenantId);
  }
}
