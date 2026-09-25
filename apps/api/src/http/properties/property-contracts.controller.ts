import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { applyDecorators } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type {
  ActivatePropertyContract, CancelPropertyContract, CreatePropertyContract, EndPropertyContract,
  ListPropertyContracts, PropertyAuthority, PropertyContractView, RetrievePropertyContract, UpdatePropertyContract,
} from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type {
  PropertyContractDirectoryResponse, PropertyContractResponse,
} from "../../contracts/v1/properties/property-client-contract.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { decodePropertyContractCursor, encodePropertyContractCursor } from "./property-client-contract-cursor.js";
import {
  CreatePropertyContractRequestDto, EndPropertyContractRequestDto, ListPropertyContractsQueryDto,
  PropertyContractDirectoryResponseDto, PropertyContractPathDto, PropertyContractResponseDto,
  PropertyContractsPathDto, UpdatePropertyContractRequestDto,
} from "./property-client-contract.dto.js";
import {
  toCreatePropertyContractCommand, toPropertyContractResponse, toUpdatePropertyContractCommand,
} from "./property-client-contract.mapper.js";

export const CREATE_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.create-property-contract-use-case");
export const LIST_PROPERTY_CONTRACTS_USE_CASE = Symbol("monpiole.list-property-contracts-use-case");
export const RETRIEVE_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.retrieve-property-contract-use-case");
export const UPDATE_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.update-property-contract-use-case");
export const ACTIVATE_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.activate-property-contract-use-case");
export const END_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.end-property-contract-use-case");
export const CANCEL_PROPERTY_CONTRACT_USE_CASE = Symbol("monpiole.cancel-property-contract-use-case");

@ApiTags("Property contracts")
@ApiSecurity("bearer")
@Controller("v1/properties/:propertyId/contracts")
@TenantContext("not-applicable")
export class PropertyContractsController {
  constructor(
    @Inject(CREATE_PROPERTY_CONTRACT_USE_CASE) private readonly create: Pick<CreatePropertyContract, "execute">,
    @Inject(LIST_PROPERTY_CONTRACTS_USE_CASE) private readonly list: Pick<ListPropertyContracts, "execute">,
    @Inject(RETRIEVE_PROPERTY_CONTRACT_USE_CASE) private readonly retrieve: Pick<RetrievePropertyContract, "execute">,
    @Inject(UPDATE_PROPERTY_CONTRACT_USE_CASE) private readonly update: Pick<UpdatePropertyContract, "execute">,
    @Inject(ACTIVATE_PROPERTY_CONTRACT_USE_CASE) private readonly activate: Pick<ActivatePropertyContract, "execute">,
    @Inject(END_PROPERTY_CONTRACT_USE_CASE) private readonly endContract: Pick<EndPropertyContract, "execute">,
    @Inject(CANCEL_PROPERTY_CONTRACT_USE_CASE) private readonly cancel: Pick<CancelPropertyContract, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: "createPropertyContract", summary: "Create a draft Property contract" })
  @ApiCreatedResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 409, 500)
  @ZodSerializerDto(PropertyContractResponseDto)
  async post(
    @Param() path: PropertyContractsPathDto, @Body() body: CreatePropertyContractRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyContractResponse> {
    const context = this.context(request);
    return toPropertyContractResponse(await this.create.execute(toCreatePropertyContractCommand(
      path.propertyId, body, context.correlationId, await context.authority,
    )));
  }

  @Get()
  @ApiOperation({ operationId: "listPropertyContracts", summary: "List contracts for a Property" })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: "cursor", required: false, schema: { type: "string", maxLength: 512 } })
  @ApiOkResponse({ type: PropertyContractDirectoryResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 500)
  @ZodSerializerDto(PropertyContractDirectoryResponseDto)
  async getAll(
    @Param() path: PropertyContractsPathDto, @Query() query: ListPropertyContractsQueryDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyContractDirectoryResponse> {
    const context = this.context(request);
    const page = await this.list.execute({
      authority: await context.authority, propertyId: path.propertyId, limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: decodePropertyContractCursor(query.cursor) }),
    });
    return {
      items: page.items.map(toPropertyContractResponse),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor: page.nextCursor === undefined ? null : encodePropertyContractCursor(page.nextCursor),
      },
      canCreateContract: page.canCreateContract,
    };
  }

  @Get(":contractId")
  @ApiOperation({ operationId: "retrievePropertyContract", summary: "Retrieve one Property contract" })
  @ApiOkResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 500)
  @ZodSerializerDto(PropertyContractResponseDto)
  async getOne(@Param() path: PropertyContractPathDto, @Req() request: RequestWithContext): Promise<PropertyContractResponse> {
    const context = this.context(request);
    return toPropertyContractResponse(await this.retrieve.execute({
      authority: await context.authority, propertyId: path.propertyId, contractId: path.contractId,
    }));
  }

  @Put(":contractId")
  @ApiOperation({ operationId: "updatePropertyContract", summary: "Replace editable draft contract terms" })
  @ApiOkResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 409, 500)
  @ZodSerializerDto(PropertyContractResponseDto)
  async put(
    @Param() path: PropertyContractPathDto, @Body() body: UpdatePropertyContractRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyContractResponse> {
    const context = this.context(request);
    return toPropertyContractResponse(await this.update.execute(toUpdatePropertyContractCommand(
      path.propertyId, path.contractId, body, context.correlationId, await context.authority,
    )));
  }

  @Post(":contractId/activate") @HttpCode(200)
  @ApiOperation({ operationId: "activatePropertyContract", summary: "Activate a draft Property contract" })
  @ApiOkResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(PropertyContractResponseDto)
  async activateContract(@Param() path: PropertyContractPathDto, @Req() request: RequestWithContext): Promise<PropertyContractResponse> {
    return this.lifecycle(path, request, (command) => this.activate.execute(command));
  }

  @Post(":contractId/end") @HttpCode(200)
  @ApiOperation({ operationId: "endPropertyContract", summary: "End an active Property contract" })
  @ApiOkResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(PropertyContractResponseDto)
  async end(
    @Param() path: PropertyContractPathDto, @Body() body: EndPropertyContractRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyContractResponse> {
    return this.lifecycle(path, request, (command) => this.endContract.execute({ ...command, endDate: body.endDate }));
  }

  @Post(":contractId/cancel") @HttpCode(200)
  @ApiOperation({ operationId: "cancelPropertyContract", summary: "Cancel a draft or active Property contract" })
  @ApiOkResponse({ type: PropertyContractResponseDto, headers: responseHeaders() })
  @ContractProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(PropertyContractResponseDto)
  async cancelContract(@Param() path: PropertyContractPathDto, @Req() request: RequestWithContext): Promise<PropertyContractResponse> {
    return this.lifecycle(path, request, (command) => this.cancel.execute(command));
  }

  private context(request: RequestWithContext) {
    const requestContext = request[REQUEST_CONTEXT];
    if (requestContext === undefined) throw new Error("Request context was not established");
    return {
      correlationId: requestContext.correlationId,
      authority: requireAuthenticatedAuthority(this.authorities, request).then(toPropertyAuthority),
    };
  }

  private async lifecycle(
    path: PropertyContractPathDto,
    request: RequestWithContext,
    execute: (command: {
      authority: PropertyAuthority; propertyId: string; contractId: string; correlationId: string;
    }) => Promise<PropertyContractView>,
  ): Promise<PropertyContractResponse> {
    const context = this.context(request);
    return toPropertyContractResponse(await execute({
      authority: await context.authority, propertyId: path.propertyId,
      contractId: path.contractId, correlationId: context.correlationId,
    }));
  }
}

type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 500;
function ContractProblems(...statuses: readonly ProblemStatus[]) {
  return applyDecorators(...statuses.map((status) => ApiResponse({
    status, description: "Problem Details", content: problemContent(), headers: responseHeaders(),
  })));
}
