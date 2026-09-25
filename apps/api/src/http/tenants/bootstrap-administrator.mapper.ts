import type {
  BootstrapTenantAdministratorCommand,
  BootstrapTenantAdministratorResult,
  IdentityOnboardingAuthority,
} from "@monpiole/identity";
import type {
  BootstrapAdministratorRequest,
  BootstrapAdministratorResponse,
} from "../../contracts/v1/tenants/bootstrap-administrator.schema.js";

export function toBootstrapAdministratorCommand(
  tenantId: string,
  request: BootstrapAdministratorRequest,
  correlationId: string,
  authority: IdentityOnboardingAuthority,
): BootstrapTenantAdministratorCommand {
  return { tenantId, ...request, correlationId, authority };
}

export function toBootstrapAdministratorResponse(
  result: BootstrapTenantAdministratorResult,
): BootstrapAdministratorResponse {
  return { ...result };
}
