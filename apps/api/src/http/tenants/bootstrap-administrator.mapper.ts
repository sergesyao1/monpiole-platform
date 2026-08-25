import type {
  BootstrapTenantAdministratorCommand,
  BootstrapTenantAdministratorResult,
} from "@monpiole/identity";
import type {
  BootstrapAdministratorRequest,
  BootstrapAdministratorResponse,
} from "../../contracts/v1/tenants/bootstrap-administrator.schema.js";

export function toBootstrapAdministratorCommand(
  tenantId: string,
  request: BootstrapAdministratorRequest,
  correlationId: string,
): BootstrapTenantAdministratorCommand {
  return { tenantId, ...request, correlationId };
}

export function toBootstrapAdministratorResponse(
  result: BootstrapTenantAdministratorResult,
): BootstrapAdministratorResponse {
  return { ...result };
}
