import { applyDecorators, Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { CreatePropertyBuilding, CreatePropertyUnit, ListPropertyBuildings, ListPropertyUnits, UpdatePropertyBuilding, UpdatePropertyUnitStructure } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { toPropertyResponse } from "./property.mapper.js";
import { decodeCompositionCursor, encodeCompositionCursor } from "./property-composition-cursor.js";
import { BuildingMutationDto, BuildingPageDto, BuildingResponseDto, CompositionQueryDto, CreateBuildingDto, CreateUnitDto, PropertyCompositionBuildingPathDto, PropertyCompositionPropertyPathDto, PropertyCompositionUnitPathDto, UnitMutationDto, UnitPageDto, UnitResponseDto } from "./property-composition.dto.js";
import { PropertyProblemDetailsDto } from "./property.dto.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";

export const CREATE_PROPERTY_BUILDING = Symbol("create-property-building"); export const LIST_PROPERTY_BUILDINGS = Symbol("list-property-buildings");
export const UPDATE_PROPERTY_BUILDING = Symbol("update-property-building"); export const CREATE_PROPERTY_UNIT = Symbol("create-property-unit");
export const LIST_PROPERTY_UNITS = Symbol("list-property-units"); export const UPDATE_PROPERTY_UNIT = Symbol("update-property-unit");

@ApiTags("Property composition") @ApiBearerAuth() @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties/:propertyId/buildings") @TenantContext("not-applicable")
export class PropertyCompositionController {
  constructor(
    @Inject(CREATE_PROPERTY_BUILDING) private readonly createBuilding: Pick<CreatePropertyBuilding, "execute">,
    @Inject(LIST_PROPERTY_BUILDINGS) private readonly listBuildings: Pick<ListPropertyBuildings, "execute">,
    @Inject(UPDATE_PROPERTY_BUILDING) private readonly updateBuilding: Pick<UpdatePropertyBuilding, "execute">,
    @Inject(CREATE_PROPERTY_UNIT) private readonly createUnit: Pick<CreatePropertyUnit, "execute">,
    @Inject(LIST_PROPERTY_UNITS) private readonly listUnits: Pick<ListPropertyUnits, "execute">,
    @Inject(UPDATE_PROPERTY_UNIT) private readonly updateUnit: Pick<UpdatePropertyUnitStructure, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider,
  ) {}
  private async context(request: RequestWithContext) { const authenticated = await requireAuthenticatedAuthority(this.authorities, request); const value = request[REQUEST_CONTEXT]; if (!value) throw new Error("Request context missing"); return { authority: toPropertyAuthority(authenticated), correlationId: value.correlationId }; }
  @Post() @HttpCode(201) @ApiOperation({ operationId: "createPropertyBuilding" }) @ApiCreatedResponse({ type: BuildingResponseDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(BuildingResponseDto)
  async postBuilding(@Param() path: PropertyCompositionPropertyPathDto, @Body() body: CreateBuildingDto, @Req() request: RequestWithContext) { return toBuildingResponse(await this.createBuilding.execute({ ...await this.context(request), propertyId: path.propertyId, ...body })); }
  @Get() @ApiOperation({ operationId: "listPropertyBuildings" }) @ApiOkResponse({ type: BuildingPageDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 500) @ZodSerializerDto(BuildingPageDto)
  async getBuildings(@Param() path: PropertyCompositionPropertyPathDto, @Query() query: CompositionQueryDto, @Req() request: RequestWithContext) { const page = await this.listBuildings.execute({ ...await this.context(request), propertyId: path.propertyId, limit: query.limit, ...(query.cursor ? { cursor: decodeCompositionCursor(query.cursor) } : {}) }); return pageResponse({ ...page, items: page.items.map(toBuildingResponse) }); }
  @Put(":buildingId") @ApiOperation({ operationId: "updatePropertyBuilding" }) @ApiOkResponse({ type: BuildingResponseDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(BuildingResponseDto)
  async putBuilding(@Param() path: PropertyCompositionBuildingPathDto, @Body() body: BuildingMutationDto, @Req() request: RequestWithContext) { return toBuildingResponse(await this.updateBuilding.execute({ ...await this.context(request), propertyId: path.propertyId, buildingId: path.buildingId, ...body })); }
  @Post(":buildingId/units") @HttpCode(201) @ApiOperation({ operationId: "createPropertyUnit" }) @ApiCreatedResponse({ type: UnitResponseDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(UnitResponseDto)
  async postUnit(@Param() path: PropertyCompositionBuildingPathDto, @Body() body: CreateUnitDto, @Req() request: RequestWithContext) { const context = await this.context(request); const unit = await this.createUnit.execute({ ...context, propertyId: path.propertyId, buildingId: path.buildingId, ...body }); return { unitCode: unit.unitCode, property: toPropertyResponse(unit.property, context.authority) }; }
  @Get(":buildingId/units") @ApiOperation({ operationId: "listPropertyUnits" }) @ApiOkResponse({ type: UnitPageDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 500) @ZodSerializerDto(UnitPageDto)
  async getUnits(@Param() path: PropertyCompositionBuildingPathDto, @Query() query: CompositionQueryDto, @Req() request: RequestWithContext) { const context = await this.context(request); const page = await this.listUnits.execute({ ...context, propertyId: path.propertyId, buildingId: path.buildingId, limit: query.limit, ...(query.cursor ? { cursor: decodeCompositionCursor(query.cursor) } : {}) }); return pageResponse({ ...page, items: page.items.map((item) => ({ unitCode: item.unitCode, property: toPropertyResponse(item.property, context.authority) })) }); }
  @Put(":buildingId/units/:unitPropertyId") @ApiOperation({ operationId: "updatePropertyUnitStructure" }) @ApiOkResponse({ type: UnitResponseDto, headers: responseHeaders() }) @CompositionProblems(400, 401, 403, 404, 409, 500) @ZodSerializerDto(UnitResponseDto)
  async putUnit(@Param() path: PropertyCompositionUnitPathDto, @Body() body: UnitMutationDto, @Req() request: RequestWithContext) { const context = await this.context(request); const unit = await this.updateUnit.execute({ ...context, propertyId: path.propertyId, buildingId: path.buildingId, unitPropertyId: path.unitPropertyId, unitCode: body.unitCode }); return { unitCode: unit.unitCode, property: toPropertyResponse(unit.property, context.authority) }; }
}
function pageResponse<T>(page: { readonly items: readonly T[]; readonly nextCursor?: { readonly code: string; readonly id: string } }) { return { items: [...page.items], pageInfo: { hasNextPage: page.nextCursor !== undefined, nextCursor: page.nextCursor ? encodeCompositionCursor(page.nextCursor) : null } }; }
function toBuildingResponse<T extends { readonly tenantId: string }>(building: T): Omit<T, "tenantId"> {
  const { tenantId: _tenantId, ...response } = building;
  return response;
}
type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 500;
export function CompositionProblems(...statuses: readonly ProblemStatus[]) {
  return applyDecorators(...statuses.map((status) => ApiResponse({ status, description: problemDescription(status), content: problemContent(), headers: responseHeaders() })));
}
function problemDescription(status: ProblemStatus) {
  if (status === 400) return "Invalid composition request";
  if (status === 401) return "Authentication required";
  if (status === 403) return "Forbidden composition authority";
  if (status === 404) return "Composition resource not found";
  if (status === 409) return "Composition conflict";
  return "Safe internal failure";
}
