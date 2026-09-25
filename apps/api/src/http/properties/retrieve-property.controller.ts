import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RetrieveProperty } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import type { PropertyResponse } from "../../contracts/v1/properties/property.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyProblemDetailsDto, PropertyResponseDto, RetrievePropertyPathDto } from "./property.dto.js";
import { toPropertyResponse } from "./property.mapper.js";

export const RETRIEVE_PROPERTY_USE_CASE = Symbol("monpiole.retrieve-property-use-case");
@ApiTags("Properties") @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties/:propertyId")
export class RetrievePropertyController {
  constructor(@Inject(RETRIEVE_PROPERTY_USE_CASE) private readonly useCase: Pick<RetrieveProperty, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider) {}
  @Get() @TenantContext("not-applicable") @ApiOperation({ operationId: "retrieveProperty", summary: "Retrieve a tenant-owned property" }) @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Tenant-owned property", type: PropertyResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid property identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyResponseDto)
  async execute(@Param() path: RetrievePropertyPathDto, @Req() request: RequestWithContext): Promise<PropertyResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const authority = toPropertyAuthority(authenticated);
    return toPropertyResponse(await this.useCase.execute({ propertyId: path.propertyId, authority }), authority);
  }
}
