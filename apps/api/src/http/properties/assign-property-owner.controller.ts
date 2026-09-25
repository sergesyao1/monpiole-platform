import { Body, Controller, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { AssignPropertyOwner } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import type { PropertyOwnershipResponse } from "../../contracts/v1/properties/property-ownership.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { AssignPropertyOwnerRequestDto, PropertyOwnershipProblemDetailsDto, PropertyOwnershipPropertyPathDto, PropertyOwnershipResponseDto } from "./property-ownership.dto.js";
import { toAssignPropertyOwnerCommand, toPropertyOwnershipResponse } from "./property-ownership.mapper.js";

export const ASSIGN_PROPERTY_OWNER_USE_CASE = Symbol("monpiole.assign-property-owner-use-case");
@ApiTags("Property Ownerships") @ApiExtraModels(PropertyOwnershipProblemDetailsDto) @Controller("v1/properties/:propertyId/owners")
export class AssignPropertyOwnerController {
  constructor(
    @Inject(ASSIGN_PROPERTY_OWNER_USE_CASE) private readonly useCase: Pick<AssignPropertyOwner, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Post() @HttpCode(201) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "assignPropertyOwner", summary: "Assign an owner to a tenant-owned property" }) @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiCreatedResponse({ description: "Property owner assigned", type: PropertyOwnershipResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid ownership", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden ownership authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property or owner not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Duplicate ownership or share total exceeded", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyOwnershipResponseDto)
  async execute(
    @Param() path: PropertyOwnershipPropertyPathDto, @Body() body: AssignPropertyOwnerRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyOwnershipResponse> {
    const context = request[REQUEST_CONTEXT]; if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyOwnershipResponse(await this.useCase.execute(toAssignPropertyOwnerCommand(
      path.propertyId, body, context.correlationId, toPropertyAuthority(authenticated),
    )));
  }
}
