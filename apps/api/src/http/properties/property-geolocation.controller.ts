import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import {
  ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam,
  ApiResponse, ApiSecurity, ApiTags,
} from "@nestjs/swagger";
import type {
  RemovePropertyGeolocation,
  RetrievePropertyGeolocation,
  UpdatePropertyGeolocation,
} from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyGeolocationResponse } from "../../contracts/v1/properties/property-geolocation.schema.js";
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
  PropertyGeolocationPathDto,
  PropertyGeolocationProblemDetailsDto,
  PropertyGeolocationResponseDto,
  UpdatePropertyGeolocationRequestDto,
} from "./property-geolocation.dto.js";
import {
  toPropertyGeolocationResponse,
  toRemovePropertyGeolocationCommand,
  toRetrievePropertyGeolocationQuery,
  toUpdatePropertyGeolocationCommand,
} from "./property-geolocation.mapper.js";

export const RETRIEVE_PROPERTY_GEOLOCATION_USE_CASE = Symbol("monpiole.retrieve-property-geolocation-use-case");
export const UPDATE_PROPERTY_GEOLOCATION_USE_CASE = Symbol("monpiole.update-property-geolocation-use-case");
export const REMOVE_PROPERTY_GEOLOCATION_USE_CASE = Symbol("monpiole.remove-property-geolocation-use-case");

@ApiTags("Property geolocation")
@ApiExtraModels(PropertyGeolocationProblemDetailsDto)
@ApiSecurity("bearer")
@Controller("v1/properties/:propertyId/geolocation")
@TenantContext("not-applicable")
export class PropertyGeolocationController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_GEOLOCATION_USE_CASE)
    private readonly retrieve: Pick<RetrievePropertyGeolocation, "execute">,
    @Inject(UPDATE_PROPERTY_GEOLOCATION_USE_CASE)
    private readonly update: Pick<UpdatePropertyGeolocation, "execute">,
    @Inject(REMOVE_PROPERTY_GEOLOCATION_USE_CASE)
    private readonly remove: Pick<RemovePropertyGeolocation, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiOperation({ operationId: "retrievePropertyGeolocation", summary: "Retrieve a Property's private effective geolocation" })
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Configured or absent effective geolocation", type: PropertyGeolocationResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  @ZodSerializerDto(PropertyGeolocationResponseDto)
  async get(@Param() path: PropertyGeolocationPathDto, @Req() request: RequestWithContext): Promise<PropertyGeolocationResponse> {
    const authority = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyGeolocationResponse(await this.retrieve.execute(
      toRetrievePropertyGeolocationQuery(path.propertyId, toPropertyAuthority(authority)),
    ));
  }

  @Put()
  @HttpCode(200)
  @ApiOperation({ operationId: "updatePropertyGeolocation", summary: "Create or replace a Property's own geolocation" })
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Canonical Property geolocation", type: PropertyGeolocationResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid coordinate, visibility, identifier or body", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 409, description: "A Unit must inherit its parent geolocation", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  @ZodSerializerDto(PropertyGeolocationResponseDto)
  async put(
    @Param() path: PropertyGeolocationPathDto,
    @Body() body: UpdatePropertyGeolocationRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyGeolocationResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authority = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyGeolocationResponse(await this.update.execute(toUpdatePropertyGeolocationCommand(
      path.propertyId, body, context.correlationId, toPropertyAuthority(authority),
    )));
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ operationId: "removePropertyGeolocation", summary: "Remove a Property's own geolocation idempotently" })
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiNoContentResponse({ description: "Geolocation absent after the operation", headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid Property identifier", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 409, description: "A Unit must inherit its parent geolocation", content: problemContent(), headers: responseHeaders() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent(), headers: responseHeaders() })
  async delete(@Param() path: PropertyGeolocationPathDto, @Req() request: RequestWithContext): Promise<void> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authority = await requireAuthenticatedAuthority(this.authorityProvider, request);
    await this.remove.execute(toRemovePropertyGeolocationCommand(
      path.propertyId, context.correlationId, toPropertyAuthority(authority),
    ));
  }
}
