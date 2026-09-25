import { applyDecorators, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { CreatePropertyClient, ListPropertyClients, RetrievePropertyClient } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type {
  PropertyClientDirectoryResponse, PropertyClientResponse,
} from "../../contracts/v1/properties/property-client-contract.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  CreatePropertyClientRequestDto, ListPropertyClientsQueryDto, PropertyClientDirectoryResponseDto,
  PropertyClientPathDto, PropertyClientResponseDto,
} from "./property-client-contract.dto.js";
import { decodePropertyClientCursor, encodePropertyClientCursor } from "./property-client-contract-cursor.js";
import { toCreatePropertyClientCommand, toPropertyClientResponse } from "./property-client-contract.mapper.js";

export const CREATE_PROPERTY_CLIENT_USE_CASE = Symbol("monpiole.create-property-client-use-case");
export const LIST_PROPERTY_CLIENTS_USE_CASE = Symbol("monpiole.list-property-clients-use-case");
export const RETRIEVE_PROPERTY_CLIENT_USE_CASE = Symbol("monpiole.retrieve-property-client-use-case");

@ApiTags("Property clients")
@ApiSecurity("bearer")
@Controller("v1/property-clients")
@TenantContext("not-applicable")
export class PropertyClientsController {
  constructor(
    @Inject(CREATE_PROPERTY_CLIENT_USE_CASE) private readonly create: Pick<CreatePropertyClient, "execute">,
    @Inject(LIST_PROPERTY_CLIENTS_USE_CASE) private readonly list: Pick<ListPropertyClients, "execute">,
    @Inject(RETRIEVE_PROPERTY_CLIENT_USE_CASE) private readonly retrieve: Pick<RetrievePropertyClient, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: "createPropertyClient", summary: "Create a reusable real-estate client" })
  @ApiCreatedResponse({ type: PropertyClientResponseDto, headers: responseHeaders() })
  @ClientProblems(400, 401, 403, 500)
  @ZodSerializerDto(PropertyClientResponseDto)
  async post(@Body() body: CreatePropertyClientRequestDto, @Req() request: RequestWithContext): Promise<PropertyClientResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authority = toPropertyAuthority(await requireAuthenticatedAuthority(this.authorities, request));
    return toPropertyClientResponse(await this.create.execute(toCreatePropertyClientCommand(
      body, context.correlationId, authority,
    )));
  }

  @Get()
  @ApiOperation({ operationId: "listPropertyClients", summary: "List reusable real-estate clients" })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: "cursor", required: false, schema: { type: "string", maxLength: 512 } })
  @ApiQuery({ name: "search", required: false, schema: { type: "string", minLength: 1, maxLength: 100 } })
  @ApiOkResponse({ type: PropertyClientDirectoryResponseDto, headers: responseHeaders() })
  @ClientProblems(400, 401, 403, 500)
  @ZodSerializerDto(PropertyClientDirectoryResponseDto)
  async getAll(
    @Query() query: ListPropertyClientsQueryDto, @Req() request: RequestWithContext,
  ): Promise<PropertyClientDirectoryResponse> {
    const authority = toPropertyAuthority(await requireAuthenticatedAuthority(this.authorities, request));
    const page = await this.list.execute({
      authority, limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: decodePropertyClientCursor(query.cursor) }),
      ...(query.search === undefined ? {} : { search: query.search }),
    });
    return {
      items: page.items.map(toPropertyClientResponse),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor: page.nextCursor === undefined ? null : encodePropertyClientCursor(page.nextCursor),
      },
      canCreateClient: page.canCreateClient,
    };
  }

  @Get(":clientId")
  @ApiOperation({ operationId: "retrievePropertyClient", summary: "Retrieve a real-estate client" })
  @ApiOkResponse({ type: PropertyClientResponseDto, headers: responseHeaders() })
  @ClientProblems(400, 401, 403, 404, 500)
  @ZodSerializerDto(PropertyClientResponseDto)
  async getOne(@Param() path: PropertyClientPathDto, @Req() request: RequestWithContext): Promise<PropertyClientResponse> {
    const authority = toPropertyAuthority(await requireAuthenticatedAuthority(this.authorities, request));
    return toPropertyClientResponse(await this.retrieve.execute({ authority, clientId: path.clientId }));
  }
}

type ProblemStatus = 400 | 401 | 403 | 404 | 500;
function ClientProblems(...statuses: readonly ProblemStatus[]) {
  return applyDecorators(...statuses.map((status) => ApiResponse({
    status, description: "Problem Details", content: problemContent(), headers: responseHeaders(),
  })));
}
