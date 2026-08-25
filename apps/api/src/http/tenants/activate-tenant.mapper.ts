import type { ActivateTenantCommand, ActivateTenantResult } from "@monpiole/tenant-management";

import type { ActivateTenantResponse } from "../../contracts/v1/tenants/activate-tenant.schema.js";

export function toActivateTenantCommand(tenantId: string, correlationId: string): ActivateTenantCommand {
  return { tenantId, correlationId };
}

export function toActivateTenantResponse(result: ActivateTenantResult): ActivateTenantResponse {
  return {
    tenantId: result.tenantId,
    lifecycleState: result.lifecycleState,
    activatedAt: result.activatedAt,
  };
}
