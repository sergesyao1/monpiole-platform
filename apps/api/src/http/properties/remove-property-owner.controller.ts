import { Controller, Delete, HttpCode, Inject, Param, Req } from "@nestjs/common";
import { ApiExtraModels, ApiNoContentResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RemovePropertyOwner } from "@monpiole/property-management";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyOwnershipPathDto, PropertyOwnershipProblemDetailsDto } from "./property-ownership.dto.js";

export const REMOVE_PROPERTY_OWNER_USE_CASE = Symbol("monpiole.remove-property-owner-use-case");
@ApiTags("Property Ownerships") @ApiExtraModels(PropertyOwnershipProblemDetailsDto) @Controller("v1/properties/:propertyId/owners/:ownerId")
export class RemovePropertyOwnerController {
  constructor(
    @Inject(REMOVE_PROPERTY_OWNER_USE_CASE) private readonly useCase: Pick<RemovePropertyOwner, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Delete() @HttpCode(204) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "removePropertyOwner", summary: "Remove a property owner assignment" }) @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "ownerId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiNoContentResponse({ description: "Property owner assignment removed", headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid property or owner identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden ownership authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property or ownership not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async execute(@Param() path: PropertyOwnershipPathDto, @Req() request: RequestWithContext): Promise<void> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    await this.useCase.execute({ propertyId: path.propertyId, ownerId: path.ownerId, authority: toPropertyAuthority(authenticated) });
  }
}
