import { Controller, ForbiddenException, Get, HttpCode, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { PlatformAuthorityAuthorizer } from "@monpiole/tenant-management";

import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toTenantManagementAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";

export const PLATFORM_AUTHORITY_AUTHORIZER = Symbol("monpiole.platform-authority-authorizer");

@ApiTags("Authentication")
@Controller("v1/authentication/authorization/platform-tenant-creation")
export class PlatformTenantCreationAuthorizationProbeController {
  constructor(
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
    @Inject(PLATFORM_AUTHORITY_AUTHORIZER)
    private readonly authorizer: PlatformAuthorityAuthorizer,
  ) {}

  @Get()
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: "probePlatformTenantCreationAuthorization",
    summary: "Probe the existing Create Tenant authorization without side effects",
  })
  @ApiNoContentResponse({ description: "The internal authority may create tenants" })
  @ApiResponse({ status: 401, description: "Missing, invalid, or unresolved authentication" })
  @ApiResponse({ status: 403, description: "Authenticated authority lacks CREATE_TENANT" })
  async execute(@Req() request: RequestWithContext): Promise<void> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const authorized = await this.authorizer.authorizeCreateTenant(toTenantManagementAuthority(authenticated));
    if (!authorized) throw new ForbiddenException("Platform tenant creation is forbidden");
  }
}
