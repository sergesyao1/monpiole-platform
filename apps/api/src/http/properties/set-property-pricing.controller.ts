import { Body, Controller, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { SetPropertyPricing } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyResponse, SetPropertyPricingRequest } from "../../contracts/v1/properties/property.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  PropertyProblemDetailsDto,
  PropertyResponseDto,
  RetrievePropertyPathDto,
  SetPropertyPricingRequestDto,
} from "./property.dto.js";
import { toPropertyResponse, toSetPropertyPricingCommand } from "./property.mapper.js";

export const SET_PROPERTY_PRICING_USE_CASE = Symbol("monpiole.set-property-pricing-use-case");

@ApiTags("Properties")
@ApiExtraModels(PropertyProblemDetailsDto)
@Controller("v1/properties/:propertyId/pricing")
export class SetPropertyPricingController {
  constructor(
    @Inject(SET_PROPERTY_PRICING_USE_CASE) private readonly useCase: Pick<SetPropertyPricing, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Put()
  @HttpCode(200)
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "setPropertyPricing", summary: "Set strict property pricing" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Property pricing updated", type: PropertyResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid or incompatible pricing", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyResponseDto)
  async execute(
    @Param() path: RetrievePropertyPathDto,
    @Body() body: SetPropertyPricingRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const authority = toPropertyAuthority(authenticated);
    return toPropertyResponse(await this.useCase.execute(toSetPropertyPricingCommand(
      path.propertyId,
      body as unknown as SetPropertyPricingRequest,
      context.correlationId,
      authority,
    )), authority);
  }
}
