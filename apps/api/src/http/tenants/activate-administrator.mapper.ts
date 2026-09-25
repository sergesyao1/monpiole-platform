import type {
  ActivateTenantAdministratorCommand,
  ActivateTenantAdministratorResult,
  IdentityOnboardingAuthority,
} from "@monpiole/identity";
import type { ActivateAdministratorResponse } from "../../contracts/v1/tenants/activate-administrator.schema.js";

export function toActivateAdministratorCommand(
  tenantId: string,
  administratorId: string,
  correlationId: string,
  authority: IdentityOnboardingAuthority,
): ActivateTenantAdministratorCommand {
  return { tenantId, administratorId, correlationId, authority };
}

export function toActivateAdministratorResponse(
  result: ActivateTenantAdministratorResult,
): ActivateAdministratorResponse {
  return { ...result };
}
