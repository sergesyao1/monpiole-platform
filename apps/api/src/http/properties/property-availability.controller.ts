import { Body, Controller, Get, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import {
  ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags,
} from "@nestjs/swagger";
import type { RetrievePropertyAvailability, UpdatePropertyAvailability } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyAvailabilityResponse } from "../../contracts/v1/properties/property-availability.schema.js";
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
  PropertyAvailabilityPathDto,
  PropertyAvailabilityResponseDto,
  ConfiguredPropertyAvailabilityResponseDto,
  UpdatePropertyAvailabilityRequestDto,
} from "./property-availability.dto.js";
import {
  toPropertyAvailabilityResponse,
  toUpdatePropertyAvailabilityCommand,
} from "./property-availability.mapper.js";
import { PropertyProblemDetailsDto } from "./property.dto.js";

export const RETRIEVE_PROPERTY_AVAILABILITY_USE_CASE = Symbol("monpiole.retrieve-property-availability-use-case");
export const UPDATE_PROPERTY_AVAILABILITY_USE_CASE = Symbol("monpiole.update-property-availability-use-case");

@ApiTags("Property availability")
@ApiExtraModels(PropertyProblemDetailsDto)
@ApiSecurity("bearer")
@Controller("v1/properties/:propertyId/availability")
@TenantContext("not-applicable")
export class PropertyAvailabilityController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_AVAILABILITY_USE_CASE)
    private readonly retrieve: Pick<RetrievePropertyAvailability, "execute">,
    @Inject(UPDATE_PROPERTY_AVAILABILITY_USE_CASE)
    private readonly update: Pick<UpdatePropertyAvailability, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiOperation({ operationId: "retrievePropertyAvailability", summary: "Retrieve direct or Unit-derived Property availability" })
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Direct snapshot or current composite summary", type: PropertyAvailabilityResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  @ZodSerializerDto(PropertyAvailabilityResponseDto)
  async get(@Param() path: PropertyAvailabilityPathDto, @Req() request: RequestWithContext): Promise<PropertyAvailabilityResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyAvailabilityResponse(await this.retrieve.execute({
      propertyId: path.propertyId,
      authority: toPropertyAuthority(authenticated),
    }));
  }

  @Put()
  @HttpCode(200)
  @ApiOperation({ operationId: "updatePropertyAvailability", summary: "Create or replace a direct Property availability snapshot" })
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Configured direct availability snapshot", type: ConfiguredPropertyAvailabilityResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier or strict body", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 409, description: "Composite availability is derived from Units", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  @ZodSerializerDto(ConfiguredPropertyAvailabilityResponseDto)
  async put(
    @Param() path: PropertyAvailabilityPathDto,
    @Body() body: UpdatePropertyAvailabilityRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyAvailabilityResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyAvailabilityResponse(await this.update.execute(toUpdatePropertyAvailabilityCommand(
      path.propertyId,
      body,
      context.correlationId,
      toPropertyAuthority(authenticated),
    )));
  }
}
