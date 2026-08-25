import { Body, Controller, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import {
  ApiCreatedResponse, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath,
} from "@nestjs/swagger";
import type { BootstrapTenantAdministrator } from "@monpiole/identity";
import { ZodSerializerDto } from "nestjs-zod";
import type { BootstrapAdministratorResponse } from "../../contracts/v1/tenants/bootstrap-administrator.schema.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import {
  BootstrapAdministratorPathDto, BootstrapAdministratorProblemDetailsDto,
  BootstrapAdministratorRequestDto, BootstrapAdministratorResponseDto,
} from "./bootstrap-administrator.dto.js";
import { toBootstrapAdministratorCommand, toBootstrapAdministratorResponse } from "./bootstrap-administrator.mapper.js";

export const BOOTSTRAP_TENANT_ADMINISTRATOR = Symbol("monpiole.bootstrap-tenant-administrator");

@ApiTags("Tenant administrators")
@ApiExtraModels(BootstrapAdministratorProblemDetailsDto)
@Controller("v1/tenants/:tenantId/administrators/bootstrap")
export class BootstrapAdministratorController {
  constructor(
    @Inject(BOOTSTRAP_TENANT_ADMINISTRATOR)
    private readonly bootstrapAdministrator: Pick<BootstrapTenantAdministrator, "execute">,
  ) {}

  @Post()
  @HttpCode(201)
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "bootstrapTenantAdministrator", summary: "Bootstrap the initial tenant administrator", security: [] })
  @ApiParam({ name: "tenantId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiCreatedResponse({
    description: "Tenant administrator bootstrapped",
    type: BootstrapAdministratorResponseDto,
    headers: {
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request", content: problemContent() })
  @ApiResponse({ status: 404, description: "Tenant not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Administrator conflict", content: problemContent() })
  @ZodSerializerDto(BootstrapAdministratorResponseDto)
  async execute(
    @Param() path: BootstrapAdministratorPathDto,
    @Body() request: BootstrapAdministratorRequestDto,
    @Req() httpRequest: RequestWithContext,
  ): Promise<BootstrapAdministratorResponse> {
    const context = httpRequest[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    return toBootstrapAdministratorResponse(await this.bootstrapAdministrator.execute(
      toBootstrapAdministratorCommand(path.tenantId, request, context.correlationId),
    ));
  }
}

function problemContent() {
  return { "application/problem+json": { schema: { $ref: getSchemaPath(BootstrapAdministratorProblemDetailsDto) } } };
}
