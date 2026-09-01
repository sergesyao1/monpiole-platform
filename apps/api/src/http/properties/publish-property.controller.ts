import { Controller, Delete, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { PublishProperty, WithdrawPropertyFromCatalog } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import type { PropertyResponse } from "../../contracts/v1/properties/property.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyProblemDetailsDto, PropertyResponseDto, RetrievePropertyPathDto } from "./property.dto.js";
import { toPropertyResponse, toPublishPropertyCommand, toWithdrawPropertyFromCatalogCommand } from "./property.mapper.js";

export const PUBLISH_PROPERTY_USE_CASE = Symbol("monpiole.publish-property-use-case");
export const WITHDRAW_PROPERTY_FROM_CATALOG_USE_CASE = Symbol("monpiole.withdraw-property-from-catalog-use-case");

@ApiTags("Properties") @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties/:propertyId/publication")
export class PublishPropertyController {
  constructor(
    @Inject(PUBLISH_PROPERTY_USE_CASE) private readonly publishUseCase: Pick<PublishProperty, "execute">,
    @Inject(WITHDRAW_PROPERTY_FROM_CATALOG_USE_CASE) private readonly withdrawUseCase: Pick<WithdrawPropertyFromCatalog, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Put() @HttpCode(200) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "publishProperty", summary: "Publish an eligible Property in the private lifecycle" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Property published or publication replayed", type: PropertyResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Property publication requirements not met or republication unsupported", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyResponseDto)
  async execute(@Param() path: RetrievePropertyPathDto, @Req() request: RequestWithContext): Promise<PropertyResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const authority = toPropertyAuthority(authenticated);
    const result = await this.publishUseCase.execute(toPublishPropertyCommand(path.propertyId, context.correlationId, authority));
    return toPropertyResponse(result.property, authority);
  }

  @Delete() @HttpCode(200) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "withdrawPropertyFromCatalog", summary: "Withdraw a published Property from the public catalog" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Property withdrawn or withdrawal replayed", type: PropertyResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Property is not currently published", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyResponseDto)
  async withdraw(@Param() path: RetrievePropertyPathDto, @Req() request: RequestWithContext): Promise<PropertyResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const authority = toPropertyAuthority(authenticated);
    const result = await this.withdrawUseCase.execute(toWithdrawPropertyFromCatalogCommand(path.propertyId, context.correlationId, authority));
    return toPropertyResponse(result.property, authority);
  }
}
