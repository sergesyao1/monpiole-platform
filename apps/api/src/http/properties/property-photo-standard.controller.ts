import { Body, Controller, Get, HttpCode, Inject, Put, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RetrievePropertyPhotoStandard, UpdatePropertyPhotoStandard } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyPhotoStandard } from "../../contracts/v1/properties/property.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { PropertyPhotoStandardDto, PropertyProblemDetailsDto } from "./property.dto.js";

export const RETRIEVE_PROPERTY_PHOTO_STANDARD_USE_CASE = Symbol("monpiole.retrieve-property-photo-standard-use-case");
export const UPDATE_PROPERTY_PHOTO_STANDARD_USE_CASE = Symbol("monpiole.update-property-photo-standard-use-case");

@ApiTags("Property photos") @ApiExtraModels(PropertyProblemDetailsDto)
@Controller("v1/property-photo-standard")
export class PropertyPhotoStandardController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_PHOTO_STANDARD_USE_CASE) private readonly retrieveStandard: Pick<RetrievePropertyPhotoStandard, "execute">,
    @Inject(UPDATE_PROPERTY_PHOTO_STANDARD_USE_CASE) private readonly updateStandard: Pick<UpdatePropertyPhotoStandard, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePropertyPhotoStandard", summary: "Retrieve the tenant photo-standard additions" })
  @ApiSecurity("bearer") @ApiOkResponse({ type: PropertyPhotoStandardDto, headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ZodSerializerDto(PropertyPhotoStandardDto)
  async retrieve(@Req() request: RequestWithContext): Promise<PropertyPhotoStandard> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const standard = await this.retrieveStandard.execute({ authority: toPropertyAuthority(authenticated) });
    return { ...standard, additionalRequiredCategories: [...standard.additionalRequiredCategories] };
  }

  @Put() @HttpCode(200) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "updatePropertyPhotoStandard", summary: "Increase tenant photo minimum and add mandatory views" })
  @ApiSecurity("bearer") @ApiOkResponse({ type: PropertyPhotoStandardDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid standard", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ZodSerializerDto(PropertyPhotoStandardDto)
  async update(@Body() body: PropertyPhotoStandardDto, @Req() request: RequestWithContext): Promise<PropertyPhotoStandard> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const standard = await this.updateStandard.execute({
      ...body, correlationId: context.correlationId, authority: toPropertyAuthority(authenticated),
    });
    return { ...standard, additionalRequiredCategories: [...standard.additionalRequiredCategories] };
  }
}
