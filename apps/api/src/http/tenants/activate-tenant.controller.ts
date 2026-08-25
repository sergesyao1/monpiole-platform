import { Controller, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from "@nestjs/swagger";
import type { ActivateTenant } from "@monpiole/tenant-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { ActivateTenantResponse } from "../../contracts/v1/tenants/activate-tenant.schema.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { ActivateTenantPathDto, ActivateTenantProblemDetailsDto, ActivateTenantResponseDto } from "./activate-tenant.dto.js";
import { toActivateTenantCommand, toActivateTenantResponse } from "./activate-tenant.mapper.js";

export const ACTIVATE_TENANT_USE_CASE = Symbol("monpiole.activate-tenant-use-case");

@ApiTags("Tenants")
@ApiExtraModels(ActivateTenantProblemDetailsDto)
@Controller("api/v1/tenants/:tenantId/activate")
export class ActivateTenantController {
  constructor(@Inject(ACTIVATE_TENANT_USE_CASE) private readonly activateTenant: Pick<ActivateTenant, "execute">) {}

  @Post()
  @HttpCode(200)
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "activateTenant", summary: "Activate a pending tenant", security: [] })
  @ApiParam({ name: "tenantId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({
    description: "Tenant active",
    type: ActivateTenantResponseDto,
    headers: {
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request", content: problemContent() })
  @ApiResponse({ status: 404, description: "Tenant not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Active administrator required", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(ActivateTenantResponseDto)
  async execute(@Param() path: ActivateTenantPathDto, @Req() request: RequestWithContext): Promise<ActivateTenantResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    return toActivateTenantResponse(await this.activateTenant.execute(
      toActivateTenantCommand(path.tenantId, context.correlationId),
    ));
  }
}

function problemContent() {
  return { "application/problem+json": { schema: { $ref: getSchemaPath(ActivateTenantProblemDetailsDto) } } };
}
