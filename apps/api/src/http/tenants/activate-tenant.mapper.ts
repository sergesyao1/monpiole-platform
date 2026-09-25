import type { ActivateTenantCommand, ActivateTenantResult, PlatformAuthority } from "@monpiole/tenant-management";

import type { ActivateTenantResponse } from "../../contracts/v1/tenants/activate-tenant.schema.js";

export function toActivateTenantCommand(
  tenantId: string,
  correlationId: string,
  authority: PlatformAuthority,
): ActivateTenantCommand {
  return { tenantId, correlationId, authority };
}

export function toActivateTenantResponse(result: ActivateTenantResult): ActivateTenantResponse {
  return {
    tenantId: result.tenantId,
    lifecycleState: result.lifecycleState,
    activatedAt: result.activatedAt,
  };
}
