import type {
  ActivateTenantAdministratorCommand,
  ActivateTenantAdministratorResult,
} from "@monpiole/identity";
import type { ActivateAdministratorResponse } from "../../contracts/v1/tenants/activate-administrator.schema.js";

export function toActivateAdministratorCommand(
  tenantId: string,
  administratorId: string,
  correlationId: string,
): ActivateTenantAdministratorCommand {
  return { tenantId, administratorId, correlationId };
}

export function toActivateAdministratorResponse(
  result: ActivateTenantAdministratorResult,
): ActivateAdministratorResponse {
  return { ...result };
}
