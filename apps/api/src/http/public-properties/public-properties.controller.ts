import { Controller, Get, Headers, Inject, Param, Query, Res } from "@nestjs/common";
import {
  ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from "@nestjs/swagger";
import type {
  ListPublicProperties, RetrievePublicPrimaryPhoto, RetrievePublicProperty,
} from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type {
  PublicPropertyCatalogResponse,
  PublicPropertyDetail,
} from "../../contracts/v1/public-properties/public-property.schema.js";
import {
  type PublicCatalogTenantResolver,
  requirePublicCatalogTenant,
} from "../../configuration/public-catalog.js";
import { problemContent, responseHeaders } from "../properties/create-property.controller.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { decodePublicPropertyCatalogCursor, encodePublicPropertyCatalogCursor } from "./public-property-cursor.js";
import {
  ListPublicPropertiesQueryDto,
  PublicPropertyCatalogResponseDto,
  PublicPropertyDetailDto,
  PublicPropertyPathDto,
  PublicPropertyProblemDetailsDto,
} from "./public-property.dto.js";
import { toPublicPropertyDetail, toPublicPropertySummary } from "./public-property.mapper.js";

export const PUBLIC_CATALOG_TENANT_RESOLVER = Symbol("monpiole.public-catalog-tenant-resolver");
export const LIST_PUBLIC_PROPERTIES_USE_CASE = Symbol("monpiole.list-public-properties-use-case");
export const RETRIEVE_PUBLIC_PROPERTY_USE_CASE = Symbol("monpiole.retrieve-public-property-use-case");
export const RETRIEVE_PUBLIC_PRIMARY_PHOTO_USE_CASE = Symbol("monpiole.retrieve-public-primary-photo-use-case");

interface BinaryResponse {
  setHeader(name: string, value: string | number): void;
  status(code: number): this;
  end(body?: Uint8Array): void;
}

@ApiTags("Public Property catalog")
@ApiExtraModels(PublicPropertyProblemDetailsDto)
@Controller("v1/public/properties")
export class PublicPropertiesController {
  constructor(
    @Inject(LIST_PUBLIC_PROPERTIES_USE_CASE) private readonly listProperties: Pick<ListPublicProperties, "execute">,
    @Inject(RETRIEVE_PUBLIC_PROPERTY_USE_CASE) private readonly retrieveProperty: Pick<RetrievePublicProperty, "execute">,
    @Inject(RETRIEVE_PUBLIC_PRIMARY_PHOTO_USE_CASE) private readonly retrievePrimaryPhoto: Pick<RetrievePublicPrimaryPhoto, "execute">,
    @Inject(PUBLIC_CATALOG_TENANT_RESOLVER) private readonly tenantResolver: PublicCatalogTenantResolver,
  ) {}

  @Get()
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "listPublicProperties", summary: "List one activated tenant's published Properties", security: [] })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } })
  @ApiQuery({ name: "cursor", required: false, schema: { type: "string", maxLength: 512 } })
  @ApiQuery({ name: "type", required: false, schema: { type: "string", enum: ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] } })
  @ApiQuery({ name: "transactionType", required: false, schema: { type: "string", enum: ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] } })
  @ApiOkResponse({ description: "Published Properties of the tenant resolved from the exact request host", type: PublicPropertyCatalogResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid catalog query or cursor", content: problemContent() })
  @ApiResponse({ status: 404, description: "Public catalog host not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PublicPropertyCatalogResponseDto)
  async list(
    @Headers("host") host: string | undefined,
    @Query() query: ListPublicPropertiesQueryDto,
    @Res({ passthrough: true }) response: BinaryResponse,
  ): Promise<PublicPropertyCatalogResponse> {
    const tenantId = requirePublicCatalogTenant(this.tenantResolver, host);
    const page = await this.listProperties.execute({
      tenantId,
      limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: decodePublicPropertyCatalogCursor(query.cursor) }),
      ...(query.type === undefined ? {} : { propertyType: query.type }),
      ...(query.transactionType === undefined ? {} : { transactionType: query.transactionType }),
    });
    setPublicJsonCache(response);
    return {
      items: page.items.map(toPublicPropertySummary),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor: page.nextCursor === undefined ? null : encodePublicPropertyCatalogCursor(page.nextCursor),
      },
    };
  }

  @Get(":publicPropertyId")
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePublicProperty", summary: "Retrieve one published Property for the resolved tenant", security: [] })
  @ApiParam({ name: "publicPropertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ description: "Public Property detail", type: PublicPropertyDetailDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid public Property identifier", content: problemContent() })
  @ApiResponse({ status: 404, description: "Public Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PublicPropertyDetailDto)
  async retrieve(
    @Headers("host") host: string | undefined,
    @Param() path: PublicPropertyPathDto,
    @Res({ passthrough: true }) response: BinaryResponse,
  ): Promise<PublicPropertyDetail> {
    const tenantId = requirePublicCatalogTenant(this.tenantResolver, host);
    const property = await this.retrieveProperty.execute({ tenantId, publicPropertyId: path.publicPropertyId });
    setPublicJsonCache(response);
    return toPublicPropertyDetail(property);
  }

  @Get(":publicPropertyId/primary-photo")
  @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePublicPropertyPrimaryPhoto", summary: "Retrieve the public primary photo of one published Property", security: [] })
  @ApiParam({ name: "publicPropertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiResponse({ status: 200, description: "Content-backed primary image", content: {
    "image/jpeg": { schema: { type: "string", format: "binary" } },
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/webp": { schema: { type: "string", format: "binary" } },
  }, headers: responseHeaders() })
  @ApiResponse({ status: 304, description: "The cached primary image is still current", headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid public Property identifier", content: problemContent() })
  @ApiResponse({ status: 404, description: "Public primary photo not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async photo(
    @Headers("host") host: string | undefined,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Param() path: PublicPropertyPathDto,
    @Res() response: BinaryResponse,
  ): Promise<void> {
    const tenantId = requirePublicCatalogTenant(this.tenantResolver, host);
    const photo = await this.retrievePrimaryPhoto.execute({ tenantId, publicPropertyId: path.publicPropertyId });
    const etag = `"${photo.contentSha256}"`;
    response.setHeader("Cache-Control", "public, max-age=300");
    response.setHeader("Vary", "Host, Origin");
    response.setHeader("ETag", etag);
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (matchesEtag(ifNoneMatch, etag)) {
      response.status(304).end();
      return;
    }
    response.setHeader("Content-Type", photo.contentType);
    response.setHeader("Content-Length", photo.contentByteSize);
    response.status(200).end(photo.content);
  }
}

function setPublicJsonCache(response: BinaryResponse): void {
  response.setHeader("Cache-Control", "public, max-age=60");
  response.setHeader("Vary", "Host, Origin");
}

function matchesEtag(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  return header.split(",").map((value) => value.trim()).some((value) => value === "*" || value === etag || value === `W/${etag}`);
}
