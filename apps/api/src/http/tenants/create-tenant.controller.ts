import { Body, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiExtraModels, ApiHeader, ApiOperation, ApiResponse, ApiSecurity, ApiTags, getSchemaPath } from "@nestjs/swagger";
import type { CreateTenant } from "@monpiole/tenant-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { CreateTenantResponse } from "../../contracts/v1/tenants/create-tenant.schema.js";
import { Idempotency, TenantContext } from "../request-context/request-context.decorator.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { CreateTenantRequestDto, CreateTenantResponseDto, TenantProblemDetailsDto } from "./create-tenant.dto.js";
import { toCreateTenantCommand, toCreateTenantResponse } from "./create-tenant.mapper.js";
import {
  AUTHENTICATED_ONBOARDING_AUTHORITY_PROVIDER,
  requireAuthenticatedOnboardingAuthority,
  toTenantManagementAuthority,
  type AuthenticatedOnboardingAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";

export const CREATE_TENANT_USE_CASE = Symbol("monpiole.create-tenant-use-case");
@ApiTags("Tenants")
@ApiExtraModels(TenantProblemDetailsDto)
@Controller("api/v1/tenants")
export class CreateTenantController {
  constructor(
    @Inject(CREATE_TENANT_USE_CASE) private readonly createTenant: Pick<CreateTenant, "execute">,
    @Inject(AUTHENTICATED_ONBOARDING_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedOnboardingAuthorityProvider,
  ) {}

  @Post()
  @HttpCode(201)
  @TenantContext("not-applicable")
  @Idempotency("required")
  @ApiOperation({ operationId: "createTenant", summary: "Create a pending tenant" })
  @ApiSecurity("bearer")
  @ApiHeader({ name: "X-Correlation-Id", required: false, schema: { type: "string", format: "uuid" } })
  @ApiHeader({ name: "Idempotency-Key", required: true, schema: { type: "string", minLength: 1, maxLength: 255 } })
  @ApiCreatedResponse({
    description: "Pending tenant created",
    type: CreateTenantResponseDto,
    headers: {
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden platform authority", content: problemContent() })
  @ApiResponse({ status: 409, description: "Duplicate or idempotency conflict", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(CreateTenantResponseDto)
  async execute(@Body() request: CreateTenantRequestDto, @Req() httpRequest: RequestWithContext): Promise<CreateTenantResponse> {
    const context = httpRequest[REQUEST_CONTEXT];
    if (context?.idempotencyKey === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedOnboardingAuthority(this.authorityProvider, httpRequest);
    const authority = toTenantManagementAuthority(authenticated);
    const result = await this.createTenant.execute(toCreateTenantCommand(request, {
      correlationId: context.correlationId,
      idempotencyKey: context.idempotencyKey,
    }, authority));
    return toCreateTenantResponse(result);
  }
}

function problemContent() {
  return { "application/problem+json": { schema: { $ref: getSchemaPath(TenantProblemDetailsDto) } } };
}
