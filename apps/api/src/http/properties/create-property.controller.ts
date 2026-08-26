import { Body, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiExtraModels, ApiOperation, ApiResponse, ApiSecurity, ApiTags, getSchemaPath } from "@nestjs/swagger";
import type { CreateProperty } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import type { PropertyResponse } from "../../contracts/v1/properties/property.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { CreatePropertyRequestDto, PropertyProblemDetailsDto, PropertyResponseDto } from "./property.dto.js";
import { toCreatePropertyCommand, toPropertyResponse } from "./property.mapper.js";

export const CREATE_PROPERTY_USE_CASE = Symbol("monpiole.create-property-use-case");
@ApiTags("Properties") @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties")
export class CreatePropertyController {
  constructor(@Inject(CREATE_PROPERTY_USE_CASE) private readonly useCase: Pick<CreateProperty, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider) {}
  @Post() @HttpCode(201) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "createProperty", summary: "Create a draft property" }) @ApiSecurity("bearer")
  @ApiCreatedResponse({ description: "Draft property created", type: PropertyResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid request", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property authority", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyResponseDto)
  async execute(@Body() body: CreatePropertyRequestDto, @Req() request: RequestWithContext): Promise<PropertyResponse> {
    const context = request[REQUEST_CONTEXT]; if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyResponse(await this.useCase.execute(toCreatePropertyCommand(body, context.correlationId, toPropertyAuthority(authenticated))));
  }
}
export function problemContent() { return { "application/problem+json": { schema: { $ref: getSchemaPath(PropertyProblemDetailsDto) } } }; }
export function responseHeaders() { return { "X-Correlation-Id": { schema: { type: "string", format: "uuid" } }, "X-Request-Id": { schema: { type: "string", format: "uuid" } } }; }
