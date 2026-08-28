import { Controller, Get, Inject, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { ListPropertyOwners } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyOwnerDirectoryResponse } from "../../contracts/v1/properties/property-owner.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
  ListPropertyOwnersQueryDto, PropertyOwnerDirectoryResponseDto, PropertyOwnerProblemDetailsDto,
} from "./property-owner.dto.js";
import { toPropertyOwnerResponse } from "./property-owner.mapper.js";
import { decodePropertyOwnerDirectoryCursor, encodePropertyOwnerDirectoryCursor } from "./property-owner-directory-cursor.js";

export const LIST_PROPERTY_OWNERS_USE_CASE = Symbol("monpiole.list-property-owners-use-case");

@ApiTags("Property Owners") @ApiExtraModels(
  PropertyOwnerProblemDetailsDto, IndividualPropertyOwnerResponseDto, LegalEntityPropertyOwnerResponseDto,
) @Controller("v1/property-owners")
export class ListPropertyOwnersController {
  constructor(
    @Inject(LIST_PROPERTY_OWNERS_USE_CASE) private readonly useCase: Pick<ListPropertyOwners, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "listPropertyOwners", summary: "List the authenticated tenant's Property owners" })
  @ApiSecurity("bearer")
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: "cursor", required: false, schema: { type: "string", maxLength: 512 } })
  @ApiQuery({ name: "search", required: false, schema: { type: "string", minLength: 1, maxLength: 100 } })
  @ApiOkResponse({
    description: "A stable page from the tenant-owned Property owner directory",
    type: PropertyOwnerDirectoryResponseDto, headers: responseHeaders(),
  })
  @ApiResponse({ status: 400, description: "Invalid directory query or cursor", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden Property owner authority", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyOwnerDirectoryResponseDto)
  async execute(@Query() query: ListPropertyOwnersQueryDto, @Req() request: RequestWithContext): Promise<PropertyOwnerDirectoryResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const page = await this.useCase.execute({
      authority: toPropertyAuthority(authenticated), limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: decodePropertyOwnerDirectoryCursor(query.cursor) }),
      ...(query.search === undefined ? {} : { search: query.search }),
    });
    return {
      items: page.items.map(toPropertyOwnerResponse),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor: page.nextCursor === undefined ? null : encodePropertyOwnerDirectoryCursor(page.nextCursor),
      },
    };
  }
}
