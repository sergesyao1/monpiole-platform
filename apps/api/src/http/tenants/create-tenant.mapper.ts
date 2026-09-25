import type { CreateTenantCommand, CreateTenantResult, PlatformAuthority } from "@monpiole/tenant-management";

import type { CreateTenantRequest, CreateTenantResponse } from "../../contracts/v1/tenants/create-tenant.schema.js";

export function toCreateTenantCommand(
  request: CreateTenantRequest,
  context: { correlationId: string; idempotencyKey: string },
  authority: PlatformAuthority,
): CreateTenantCommand {
  return { ...request, ...context, authority };
}

export function toCreateTenantResponse(result: CreateTenantResult): CreateTenantResponse {
  return { tenantId: result.tenantId, lifecycleState: result.lifecycleState };
}
