import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CreatePropertyComplexChild, ListPropertyComplexChildren } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { toPropertyResponse } from "./property.mapper.js";
import { decodeCompositionCursor, encodeCompositionCursor } from "./property-composition-cursor.js";
import { ComplexChildPageDto, ComplexChildResponseDto, CompositionQueryDto, CreateComplexChildDto, PropertyCompositionPropertyPathDto } from "./property-composition.dto.js";
import { CompositionProblems } from "./property-composition.controller.js";
import { PropertyProblemDetailsDto } from "./property.dto.js";
import { responseHeaders } from "./create-property.controller.js";

export const CREATE_PROPERTY_COMPLEX_CHILD = Symbol("create-property-complex-child");
export const LIST_PROPERTY_COMPLEX_CHILDREN = Symbol("list-property-complex-children");

@ApiTags("Property composition") @ApiBearerAuth() @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties/:propertyId/children") @TenantContext("not-applicable")
export class PropertyComplexChildrenController {
  constructor(
    @Inject(CREATE_PROPERTY_COMPLEX_CHILD) private readonly createChild: Pick<CreatePropertyComplexChild, "execute">,
    @Inject(LIST_PROPERTY_COMPLEX_CHILDREN) private readonly listChildren: Pick<ListPropertyComplexChildren, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider,
  ) {}

  private async context(request: RequestWithContext) {
    const authenticated = await requireAuthenticatedAuthority(this.authorities, request);
    const value = request[REQUEST_CONTEXT];
    if (!value) throw new Error("Request context missing");
    return { authority: toPropertyAuthority(authenticated), correlationId: value.correlationId };
  }

  @Post() @HttpCode(201) @ApiOperation({ operationId: "createPropertyComplexChild" })
  @ApiCreatedResponse({ type: ComplexChildResponseDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(ComplexChildResponseDto)
  async post(@Param() path: PropertyCompositionPropertyPathDto, @Body() body: CreateComplexChildDto, @Req() request: RequestWithContext) {
    const context = await this.context(request);
    const result = await this.createChild.execute({ ...context, propertyId: path.propertyId, ...body });
    return { childCode: result.childCode, property: toPropertyResponse(result.property, context.authority) };
  }

  @Get() @ApiOperation({ operationId: "listPropertyComplexChildren" })
  @ApiOkResponse({ type: ComplexChildPageDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 500) @ZodSerializerDto(ComplexChildPageDto)
  async get(@Param() path: PropertyCompositionPropertyPathDto, @Query() query: CompositionQueryDto, @Req() request: RequestWithContext) {
    const context = await this.context(request);
    const page = await this.listChildren.execute({ ...context, propertyId: path.propertyId, limit: query.limit,
      ...(query.cursor ? { cursor: decodeCompositionCursor(query.cursor) } : {}) });
    return { items: page.items.map((item) => ({ childCode: item.childCode, property: toPropertyResponse(item.property, context.authority) })),
      pageInfo: { hasNextPage: page.nextCursor !== undefined, nextCursor: page.nextCursor ? encodeCompositionCursor(page.nextCursor) : null } };
  }
}
