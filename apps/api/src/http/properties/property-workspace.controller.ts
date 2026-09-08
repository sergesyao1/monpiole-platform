import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RetrievePropertyWorkspace } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyWorkspaceResponse } from "../../contracts/v1/properties/property-client-contract.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyContractsPathDto, PropertyWorkspaceResponseDto } from "./property-client-contract.dto.js";
import { toPropertyWorkspaceResponse } from "./property-client-contract.mapper.js";

export const RETRIEVE_PROPERTY_WORKSPACE_USE_CASE = Symbol("monpiole.retrieve-property-workspace-use-case");

@ApiTags("Property workspace")
@ApiSecurity("bearer")
@Controller("v1/properties/:propertyId/workspace")
@TenantContext("not-applicable")
export class PropertyWorkspaceController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_WORKSPACE_USE_CASE) private readonly retrieve: Pick<RetrievePropertyWorkspace, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiOperation({ operationId: "retrievePropertyWorkspace", summary: "Retrieve the canonical private Property workspace" })
  @ApiOkResponse({ type: PropertyWorkspaceResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  @ZodSerializerDto(PropertyWorkspaceResponseDto)
  async get(@Param() path: PropertyContractsPathDto, @Req() request: RequestWithContext): Promise<PropertyWorkspaceResponse> {
    const authority = toPropertyAuthority(await requireAuthenticatedAuthority(this.authorities, request));
    return toPropertyWorkspaceResponse(await this.retrieve.execute({ authority, propertyId: path.propertyId }), authority);
  }
}
