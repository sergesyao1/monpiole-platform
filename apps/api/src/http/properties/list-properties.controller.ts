import { Controller, Get, Inject, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { ListProperties } from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyPortfolioResponse } from "../../contracts/v1/properties/property.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import { ListPropertiesQueryDto, PropertyPortfolioResponseDto, PropertyProblemDetailsDto } from "./property.dto.js";
import { decodePropertyPortfolioCursor, encodePropertyPortfolioCursor } from "./property-portfolio-cursor.js";

export const LIST_PROPERTIES_USE_CASE = Symbol("monpiole.list-properties-use-case");

@ApiTags("Properties") @ApiExtraModels(PropertyProblemDetailsDto) @Controller("v1/properties")
export class ListPropertiesController {
  constructor(
    @Inject(LIST_PROPERTIES_USE_CASE) private readonly useCase: Pick<ListProperties, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "listProperties", summary: "List the authenticated tenant's private Property portfolio" })
  @ApiSecurity("bearer")
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: "cursor", required: false, schema: { type: "string", maxLength: 512 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "WITHDRAWN"] } })
  @ApiQuery({ name: "type", required: false, schema: { type: "string", enum: ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] } })
  @ApiQuery({ name: "search", required: false, schema: { type: "string", minLength: 1, maxLength: 100 } })
  @ApiOkResponse({ description: "A stable page from the tenant-owned Property portfolio", type: PropertyPortfolioResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid discovery query or cursor", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyPortfolioResponseDto)
  async execute(@Query() query: ListPropertiesQueryDto, @Req() request: RequestWithContext): Promise<PropertyPortfolioResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const page = await this.useCase.execute({
      authority: toPropertyAuthority(authenticated), limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: decodePropertyPortfolioCursor(query.cursor) }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.type === undefined ? {} : { propertyType: query.type }),
      ...(query.search === undefined ? {} : { search: query.search }),
    });
    return {
      items: page.items.map((item) => {
        if (item.status === "DRAFT") return { ...item, status: "DRAFT" as const };
        const publishedAt = requiredPublicationInstant(item.publishedAt);
        return item.status === "PUBLISHED"
          ? { ...item, status: "PUBLISHED" as const, publishedAt }
          : { ...item, status: "WITHDRAWN" as const, publishedAt, withdrawnAt: requiredWithdrawalInstant(item.withdrawnAt) };
      }),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor: page.nextCursor === undefined ? null : encodePropertyPortfolioCursor(page.nextCursor),
      },
    };
  }
}

function requiredPublicationInstant(value: string | undefined): string {
  if (value === undefined) throw new Error("Published portfolio item is missing its publication instant");
  return value;
}

function requiredWithdrawalInstant(value: string | undefined): string {
  if (value === undefined) throw new Error("Withdrawn portfolio item is missing its withdrawal instant");
  return value;
}
