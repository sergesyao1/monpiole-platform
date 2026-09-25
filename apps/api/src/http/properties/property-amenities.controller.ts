import { Body, Controller, Get, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { ReplacePropertyAmenities, RetrieveAmenityCatalog, RetrievePropertyAmenities } from "@monpiole/property-management";
import { createZodDto, ZodSerializerDto } from "nestjs-zod";
import { AmenityCatalogResponseSchema, PropertyAmenitiesPathSchema, PropertyAmenitiesResponseSchema, ReplacePropertyAmenitiesRequestSchema, type AmenityCatalogResponse, type PropertyAmenitiesResponse } from "../../contracts/v1/properties/property-amenity.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
export const RETRIEVE_AMENITY_CATALOG = Symbol("retrieve-amenity-catalog"); export const RETRIEVE_PROPERTY_AMENITIES = Symbol("retrieve-property-amenities"); export const REPLACE_PROPERTY_AMENITIES = Symbol("replace-property-amenities");
class PathDto extends createZodDto(PropertyAmenitiesPathSchema) {} class ReplaceDto extends createZodDto(ReplacePropertyAmenitiesRequestSchema) {} class CatalogDto extends createZodDto(AmenityCatalogResponseSchema) {} class SelectionDto extends createZodDto(PropertyAmenitiesResponseSchema) {}
@ApiTags("Property amenities") @ApiSecurity("bearer") @Controller("v1") @TenantContext("not-applicable")
export class PropertyAmenitiesController {
  constructor(@Inject(RETRIEVE_AMENITY_CATALOG) private readonly catalog: Pick<RetrieveAmenityCatalog,"execute">, @Inject(RETRIEVE_PROPERTY_AMENITIES) private readonly retrieve: Pick<RetrievePropertyAmenities,"execute">, @Inject(REPLACE_PROPERTY_AMENITIES) private readonly replace: Pick<ReplacePropertyAmenities,"execute">, @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorities: AuthenticatedAuthorityProvider) {}
  @Get("amenities") @ApiOperation({ operationId: "retrieveAmenityCatalog" }) @ApiOkResponse({ type: CatalogDto }) @ZodSerializerDto(CatalogDto)
  async getCatalog(@Req() request: RequestWithContext): Promise<AmenityCatalogResponse> { await requireAuthenticatedAuthority(this.authorities, request); return { items: [...this.catalog.execute()] }; }
  @Get("properties/:propertyId/amenities") @ApiOperation({ operationId: "retrievePropertyAmenities" }) @ApiOkResponse({ type: SelectionDto }) @ZodSerializerDto(SelectionDto)
  async get(@Param() path: PathDto, @Req() request: RequestWithContext): Promise<PropertyAmenitiesResponse> { const authority = await requireAuthenticatedAuthority(this.authorities, request); return { amenityCodes: [...await this.retrieve.execute({ propertyId: path.propertyId, authority: toPropertyAuthority(authority) })] }; }
  @Put("properties/:propertyId/amenities") @HttpCode(200) @ApiOperation({ operationId: "replacePropertyAmenities" }) @ApiOkResponse({ type: SelectionDto }) @ZodSerializerDto(SelectionDto)
  async put(@Param() path: PathDto, @Body() body: ReplaceDto, @Req() request: RequestWithContext): Promise<PropertyAmenitiesResponse> { const context=request[REQUEST_CONTEXT]; if(!context) throw new Error("Request context was not established"); const authority=await requireAuthenticatedAuthority(this.authorities,request); return { amenityCodes: [...await this.replace.execute({ propertyId:path.propertyId, amenityCodes:body.amenityCodes, correlationId:context.correlationId, authority:toPropertyAuthority(authority) })] }; }
}
