import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CreatePropertyBuilding, CreatePropertyUnit, ListPropertyBuildings, ListPropertyUnits, UpdatePropertyBuilding, UpdatePropertyUnitStructure } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { toPropertyResponse } from "./property.mapper.js";
import { decodeCompositionCursor, encodeCompositionCursor } from "./property-composition-cursor.js";
import { BuildingMutationDto, BuildingPageDto, BuildingResponseDto, CompositionPathDto, CompositionQueryDto, CreateUnitDto, UnitMutationDto, UnitPageDto, UnitResponseDto } from "./property-composition.dto.js";

export const CREATE_PROPERTY_BUILDING = Symbol("create-property-building"); export const LIST_PROPERTY_BUILDINGS = Symbol("list-property-buildings");
export const UPDATE_PROPERTY_BUILDING = Symbol("update-property-building"); export const CREATE_PROPERTY_UNIT = Symbol("create-property-unit");
export const LIST_PROPERTY_UNITS = Symbol("list-property-units"); export const UPDATE_PROPERTY_UNIT = Symbol("update-property-unit");

@ApiTags("Property composition") @ApiBearerAuth() @Controller("v1/properties/:propertyId/buildings") @TenantContext("not-applicable")
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
  @Post() @HttpCode(201) @ApiOperation({ operationId: "createPropertyBuilding" }) @ApiCreatedResponse({ type: BuildingResponseDto }) @ZodSerializerDto(BuildingResponseDto)
  async postBuilding(@Param() path: CompositionPathDto, @Body() body: BuildingMutationDto, @Req() request: RequestWithContext) { return this.createBuilding.execute({ ...await this.context(request), propertyId: path.propertyId, ...body }); }
  @Get() @ApiOperation({ operationId: "listPropertyBuildings" }) @ApiOkResponse({ type: BuildingPageDto }) @ZodSerializerDto(BuildingPageDto)
  async getBuildings(@Param() path: CompositionPathDto, @Query() query: CompositionQueryDto, @Req() request: RequestWithContext) { const page = await this.listBuildings.execute({ ...await this.context(request), propertyId: path.propertyId, limit: query.limit, ...(query.cursor ? { cursor: decodeCompositionCursor(query.cursor) } : {}) }); return pageResponse(page); }
  @Put(":buildingId") @ApiOperation({ operationId: "updatePropertyBuilding" }) @ApiOkResponse({ type: BuildingResponseDto }) @ZodSerializerDto(BuildingResponseDto)
  async putBuilding(@Param() path: CompositionPathDto, @Body() body: BuildingMutationDto, @Req() request: RequestWithContext) { return this.updateBuilding.execute({ ...await this.context(request), propertyId: path.propertyId, buildingId: required(path.buildingId), ...body }); }
  @Post(":buildingId/units") @HttpCode(201) @ApiOperation({ operationId: "createPropertyUnit" }) @ApiCreatedResponse({ type: UnitResponseDto }) @ZodSerializerDto(UnitResponseDto)
  async postUnit(@Param() path: CompositionPathDto, @Body() body: CreateUnitDto, @Req() request: RequestWithContext) { const unit = await this.createUnit.execute({ ...await this.context(request), propertyId: path.propertyId, buildingId: required(path.buildingId), ...body }); return { unitCode: unit.unitCode, property: toPropertyResponse(unit.property) }; }
  @Get(":buildingId/units") @ApiOperation({ operationId: "listPropertyUnits" }) @ApiOkResponse({ type: UnitPageDto }) @ZodSerializerDto(UnitPageDto)
  async getUnits(@Param() path: CompositionPathDto, @Query() query: CompositionQueryDto, @Req() request: RequestWithContext) { const page = await this.listUnits.execute({ ...await this.context(request), propertyId: path.propertyId, buildingId: required(path.buildingId), limit: query.limit, ...(query.cursor ? { cursor: decodeCompositionCursor(query.cursor) } : {}) }); return pageResponse({ ...page, items: page.items.map((item) => ({ unitCode: item.unitCode, property: toPropertyResponse(item.property) })) }); }
  @Put(":buildingId/units/:unitPropertyId") @ApiOperation({ operationId: "updatePropertyUnitStructure" }) @ApiOkResponse({ type: UnitResponseDto }) @ZodSerializerDto(UnitResponseDto)
  async putUnit(@Param() path: CompositionPathDto, @Body() body: UnitMutationDto, @Req() request: RequestWithContext) { const unit = await this.updateUnit.execute({ ...await this.context(request), propertyId: path.propertyId, buildingId: required(path.buildingId), unitPropertyId: required(path.unitPropertyId), unitCode: body.unitCode }); return { unitCode: unit.unitCode, property: toPropertyResponse(unit.property) }; }
}
function required(value?: string): string { if (!value) throw new Error("Validated path parameter missing"); return value; }
function pageResponse<T>(page: { readonly items: readonly T[]; readonly nextCursor?: { readonly code: string; readonly id: string } }) { return { items: [...page.items], pageInfo: { hasNextPage: page.nextCursor !== undefined, nextCursor: page.nextCursor ? encodeCompositionCursor(page.nextCursor) : null } }; }
