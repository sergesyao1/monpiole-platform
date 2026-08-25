import { Controller, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import {
  ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath,
} from "@nestjs/swagger";
import type { ActivateTenantAdministrator } from "@monpiole/identity";
import { ZodSerializerDto } from "nestjs-zod";
import type { ActivateAdministratorResponse } from "../../contracts/v1/tenants/activate-administrator.schema.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import {
  ActivateAdministratorPathDto, ActivateAdministratorProblemDetailsDto, ActivateAdministratorResponseDto,
} from "./activate-administrator.dto.js";
import { toActivateAdministratorCommand, toActivateAdministratorResponse } from "./activate-administrator.mapper.js";

export const ACTIVATE_TENANT_ADMINISTRATOR = Symbol("monpiole.activate-tenant-administrator");

@ApiTags("Tenant administrators")
@ApiExtraModels(ActivateAdministratorProblemDetailsDto)
@Controller("v1/tenants/:tenantId/administrators/:administratorId/activate")
export class ActivateAdministratorController {
  constructor(
    @Inject(ACTIVATE_TENANT_ADMINISTRATOR)
    private readonly activateAdministrator: Pick<ActivateTenantAdministrator, "execute">,
  ) {}

  @Post()
  @HttpCode(200)
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "activateTenantAdministrator", summary: "Activate a tenant administrator", security: [] })
  @ApiParam({ name: "tenantId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "administratorId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({
    description: "Tenant administrator active",
    type: ActivateAdministratorResponseDto,
    headers: {
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request", content: problemContent() })
  @ApiResponse({ status: 404, description: "Tenant administrator not found", content: problemContent() })
  @ZodSerializerDto(ActivateAdministratorResponseDto)
  async execute(
    @Param() path: ActivateAdministratorPathDto,
    @Req() httpRequest: RequestWithContext,
  ): Promise<ActivateAdministratorResponse> {
    const context = httpRequest[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    return toActivateAdministratorResponse(await this.activateAdministrator.execute(
      toActivateAdministratorCommand(path.tenantId, path.administratorId, context.correlationId),
    ));
  }
}

function problemContent() {
  return { "application/problem+json": { schema: { $ref: getSchemaPath(ActivateAdministratorProblemDetailsDto) } } };
}
