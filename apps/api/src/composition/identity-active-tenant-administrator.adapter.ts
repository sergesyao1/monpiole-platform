import type { HasActiveTenantAdministrator } from "@monpiole/identity";
import type { ActiveTenantAdministratorPort } from "@monpiole/tenant-management";

export class IdentityActiveTenantAdministratorAdapter implements ActiveTenantAdministratorPort {
  constructor(private readonly query: Pick<HasActiveTenantAdministrator, "execute">) {}

  hasActiveTenantAdministrator(tenantId: string): Promise<boolean> {
    return this.query.execute(tenantId);
  }
}
