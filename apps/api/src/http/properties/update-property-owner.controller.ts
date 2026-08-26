import { Body, Controller, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiBody, ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { UpdatePropertyOwner } from "@monpiole/property-management";
import type { PropertyOwnerResponse } from "../../contracts/v1/properties/property-owner.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  IndividualPropertyOwnerInputDto, IndividualPropertyOwnerResponseDto,
  LegalEntityPropertyOwnerInputDto, LegalEntityPropertyOwnerResponseDto,
  PropertyOwnerPathDto, PropertyOwnerProblemDetailsDto, PropertyOwnerTransportInputDto,
} from "./property-owner.dto.js";
import { parsePropertyOwnerResponse, parseUpdatePropertyOwnerRequest, propertyOwnerInputSchema, propertyOwnerResponseSchema } from "./property-owner.contract.js";
import { toPropertyOwnerResponse, toUpdatePropertyOwnerCommand } from "./property-owner.mapper.js";

export const UPDATE_PROPERTY_OWNER_USE_CASE = Symbol("monpiole.update-property-owner-use-case");
@ApiTags("Property Owners") @ApiExtraModels(
  PropertyOwnerProblemDetailsDto, IndividualPropertyOwnerInputDto, LegalEntityPropertyOwnerInputDto,
  IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
) @Controller("v1/property-owners/:ownerId")
export class UpdatePropertyOwnerController {
  constructor(
    @Inject(UPDATE_PROPERTY_OWNER_USE_CASE) private readonly useCase: Pick<UpdatePropertyOwner, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Put() @HttpCode(200) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "updatePropertyOwner", summary: "Update a property owner without changing its type" }) @ApiSecurity("bearer")
  @ApiParam({ name: "ownerId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiBody({ schema: propertyOwnerInputSchema })
  @ApiOkResponse({ description: "Property owner updated", schema: propertyOwnerResponseSchema, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid owner or owner type change", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property owner authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property owner not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async execute(
    @Param() path: PropertyOwnerPathDto,
    @Body() body: PropertyOwnerTransportInputDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyOwnerResponse> {
    const context = request[REQUEST_CONTEXT]; if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return parsePropertyOwnerResponse(toPropertyOwnerResponse(await this.useCase.execute(toUpdatePropertyOwnerCommand(
      path.ownerId, parseUpdatePropertyOwnerRequest(body), context.correlationId, toPropertyAuthority(authenticated),
    ))));
  }
}
