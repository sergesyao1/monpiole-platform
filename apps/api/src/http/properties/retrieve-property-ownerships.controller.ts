import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RetrievePropertyOwnerships } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import type { PropertyOwnershipResponse } from "../../contracts/v1/properties/property-ownership.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyOwnershipListResponseDto, PropertyOwnershipProblemDetailsDto, PropertyOwnershipPropertyPathDto } from "./property-ownership.dto.js";
import { toPropertyOwnershipResponse } from "./property-ownership.mapper.js";

export const RETRIEVE_PROPERTY_OWNERSHIPS_USE_CASE = Symbol("monpiole.retrieve-property-ownerships-use-case");
@ApiTags("Property Ownerships") @ApiExtraModels(PropertyOwnershipProblemDetailsDto) @Controller("v1/properties/:propertyId/owners")
export class RetrievePropertyOwnershipsController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_OWNERSHIPS_USE_CASE) private readonly useCase: Pick<RetrievePropertyOwnerships, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePropertyOwnerships", summary: "Retrieve owners assigned to a tenant-owned property" }) @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Property ownership assignments", type: PropertyOwnershipListResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid property identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden ownership authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyOwnershipListResponseDto)
  async execute(@Param() path: PropertyOwnershipPropertyPathDto, @Req() request: RequestWithContext): Promise<readonly PropertyOwnershipResponse[]> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const values = await this.useCase.execute({ propertyId: path.propertyId, authority: toPropertyAuthority(authenticated) });
    return values.map(toPropertyOwnershipResponse);
  }
}
