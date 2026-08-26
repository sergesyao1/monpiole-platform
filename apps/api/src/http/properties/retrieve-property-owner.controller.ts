import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { RetrievePropertyOwner } from "@monpiole/property-management";
import type { PropertyOwnerResponse } from "../../contracts/v1/properties/property-owner.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
  PropertyOwnerPathDto, PropertyOwnerProblemDetailsDto,
} from "./property-owner.dto.js";
import { parsePropertyOwnerResponse, propertyOwnerResponseSchema } from "./property-owner.contract.js";
import { toPropertyOwnerResponse } from "./property-owner.mapper.js";

export const RETRIEVE_PROPERTY_OWNER_USE_CASE = Symbol("monpiole.retrieve-property-owner-use-case");
@ApiTags("Property Owners") @ApiExtraModels(
  PropertyOwnerProblemDetailsDto, IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
) @Controller("v1/property-owners/:ownerId")
export class RetrievePropertyOwnerController {
  constructor(
    @Inject(RETRIEVE_PROPERTY_OWNER_USE_CASE) private readonly useCase: Pick<RetrievePropertyOwner, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}
  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePropertyOwner", summary: "Retrieve a tenant-owned property owner" }) @ApiSecurity("bearer")
  @ApiParam({ name: "ownerId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Tenant-owned property owner", schema: propertyOwnerResponseSchema, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid property owner identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden property owner authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property owner not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async execute(@Param() path: PropertyOwnerPathDto, @Req() request: RequestWithContext): Promise<PropertyOwnerResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return parsePropertyOwnerResponse(toPropertyOwnerResponse(await this.useCase.execute({ ownerId: path.ownerId, authority: toPropertyAuthority(authenticated) })));
  }
}
