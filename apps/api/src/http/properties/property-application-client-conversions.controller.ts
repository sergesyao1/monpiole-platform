import { Controller, Get, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { ConvertPropertyApplicationToClient, RetrievePropertyApplicationClientConversion } from "@monpiole/property-management";
import { createZodDto, ZodSerializerDto } from "nestjs-zod";
import { PropertyApplicationClientConversionSchema, PropertyApplicationPathSchema } from "../../contracts/v1/properties/property-application.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";

export const CONVERT_PROPERTY_APPLICATION_TO_CLIENT = Symbol("convert-property-application-to-client");
export const RETRIEVE_PROPERTY_APPLICATION_CLIENT = Symbol("retrieve-property-application-client");
class PathDto extends createZodDto(PropertyApplicationPathSchema) {}
class ConversionDto extends createZodDto(PropertyApplicationClientConversionSchema) {}

@ApiTags("Property applications") @ApiSecurity("bearer")
@Controller("v1/properties/:propertyId/applications/:applicationId/client") @TenantContext("not-applicable")
export class PropertyApplicationClientConversionsController {
  constructor(
    @Inject(CONVERT_PROPERTY_APPLICATION_TO_CLIENT) private readonly convert: Pick<ConvertPropertyApplicationToClient, "execute">,
    @Inject(RETRIEVE_PROPERTY_APPLICATION_CLIENT) private readonly retrieve: Pick<RetrievePropertyApplicationClientConversion, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly auth: AuthenticatedAuthorityProvider,
  ) {}
  @Post() @HttpCode(200) @ApiOperation({ operationId: "convertPropertyApplicationToClient" }) @ApiOkResponse({ type: ConversionDto }) @ZodSerializerDto(ConversionDto)
  async post(@Param() path: PathDto, @Req() request: RequestWithContext) {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context missing");
    return toResponse(await this.convert.execute({ authority: await this.authority(request), ...path, correlationId: context.correlationId }));
  }
  @Get() @ApiOperation({ operationId: "retrievePropertyApplicationClient" }) @ApiOkResponse({ type: ConversionDto }) @ZodSerializerDto(ConversionDto)
  async get(@Param() path: PathDto, @Req() request: RequestWithContext) {
    return toResponse(await this.retrieve.execute({ authority: await this.authority(request), ...path }));
  }
  private async authority(request: RequestWithContext) {
    return toPropertyAuthority(await requireAuthenticatedAuthority(this.auth, request));
  }
}

function toResponse(conversion: Awaited<ReturnType<ConvertPropertyApplicationToClient["execute"]>>) {
  const client = conversion.client.values;
  return { applicationId: conversion.applicationId, convertedAt: conversion.convertedAt, client: {
    clientId: client.clientId, displayName: client.displayName,
    ...(client.email === undefined ? {} : { email: client.email }),
    ...(client.phoneNumber === undefined ? {} : { phoneNumber: client.phoneNumber }),
    createdAt: client.createdAt, updatedAt: client.updatedAt,
  } };
}
