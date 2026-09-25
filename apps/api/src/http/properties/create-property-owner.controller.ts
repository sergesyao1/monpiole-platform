import { Body, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiExtraModels, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { CreatePropertyOwner } from "@monpiole/property-management";
import type { PropertyOwnerResponse } from "../../contracts/v1/properties/property-owner.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  IndividualPropertyOwnerInputDto, IndividualPropertyOwnerResponseDto,
  LegalEntityPropertyOwnerInputDto, LegalEntityPropertyOwnerResponseDto,
  PropertyOwnerProblemDetailsDto, PropertyOwnerTransportInputDto,
} from "./property-owner.dto.js";
import { parseCreatePropertyOwnerRequest, parsePropertyOwnerResponse, propertyOwnerInputSchema, propertyOwnerResponseSchema } from "./property-owner.contract.js";
import { toCreatePropertyOwnerCommand, toPropertyOwnerResponse } from "./property-owner.mapper.js";

export const CREATE_PROPERTY_OWNER_USE_CASE = Symbol("monpiole.create-property-owner-use-case");
@ApiTags("Property Owners") @ApiExtraModels(
  PropertyOwnerProblemDetailsDto, IndividualPropertyOwnerInputDto, LegalEntityPropertyOwnerInputDto,
  IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
) @Controller("v1/property-owners")
export class CreatePropertyOwnerController {
  constructor(
    @Inject(CREATE_PROPERTY_OWNER_USE_CASE) private readonly useCase: Pick<CreatePropertyOwner, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Post() @HttpCode(201) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "createPropertyOwner", summary: "Create a property owner" }) @ApiSecurity("bearer")
  @ApiBody({ schema: propertyOwnerInputSchema })
  @ApiCreatedResponse({ description: "Property owner created", schema: propertyOwnerResponseSchema, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid property owner", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property owner authority", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async execute(@Body() body: PropertyOwnerTransportInputDto, @Req() request: RequestWithContext): Promise<PropertyOwnerResponse> {
    const context = request[REQUEST_CONTEXT]; if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return parsePropertyOwnerResponse(toPropertyOwnerResponse(await this.useCase.execute(toCreatePropertyOwnerCommand(
      parseCreatePropertyOwnerRequest(body), context.correlationId, toPropertyAuthority(authenticated),
    ))));
  }
}
