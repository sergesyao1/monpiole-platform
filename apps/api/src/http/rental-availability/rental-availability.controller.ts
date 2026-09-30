import { Controller, Get, Headers, Inject, Param, Query, Req } from "@nestjs/common";
import {
  ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags,
} from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";

import type {
  PublicRentalAvailabilityResponse,
  RentalAvailabilityResponse,
} from "../../contracts/v1/rental-availability/rental-availability.schema.js";
import type { PublicCatalogTenantResolver } from "../../configuration/public-catalog.js";
import { requirePublicCatalogTenant } from "../../configuration/public-catalog.js";
import type {
  RetrievePrivateRentalAvailability,
  RetrievePublicRentalAvailability,
} from "../../operations/rental-availability.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import { problemContent, responseHeaders } from "../properties/create-property.controller.js";
import { PUBLIC_CATALOG_TENANT_RESOLVER } from "../public-properties/public-properties.controller.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import {
  RentalAvailabilityPathDto,
  PublicRentalAvailabilityResponseDto,
  RentalAvailabilityQueryDto,
  RentalAvailabilityResponseDto,
} from "./rental-availability.dto.js";

export const RETRIEVE_PRIVATE_RENTAL_AVAILABILITY = Symbol("monpiole.retrieve-private-rental-availability");
export const RETRIEVE_PUBLIC_RENTAL_AVAILABILITY = Symbol("monpiole.retrieve-public-rental-availability");

@ApiTags("Rental availability")
@ApiExtraModels(RentalAvailabilityResponseDto)
@Controller("v1/properties/:propertyId/rental-availability")
@ApiSecurity("bearer")
@TenantContext("not-applicable")
export class PrivateRentalAvailabilityController {
  constructor(
    @Inject(RETRIEVE_PRIVATE_RENTAL_AVAILABILITY)
    private readonly availability: Pick<RetrievePrivateRentalAvailability, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiOperation({ operationId: "retrievePrivateRentalAvailability", summary: "Evaluate tenant-scoped temporal rental availability" })
  @ApiParam({ name: "propertyId", schema: { type: "string", format: "uuid" } })
  @ApiQuery({ name: "startsAt", schema: { type: "string", format: "date-time" } })
  @ApiQuery({ name: "endsAt", schema: { type: "string", format: "date-time" } })
  @ApiOkResponse({ type: RentalAvailabilityResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid UTC half-open interval", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden Property authority", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ZodSerializerDto(RentalAvailabilityResponseDto)
  async retrieve(
    @Param() path: RentalAvailabilityPathDto,
    @Query() query: RentalAvailabilityQueryDto,
    @Req() request: RequestWithContext,
  ): Promise<RentalAvailabilityResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return this.availability.execute({
      authority: toPropertyAuthority(authenticated), propertyId: path.propertyId,
      startsAt: query.startsAt, endsAt: query.endsAt,
    });
  }
}

@ApiTags("Public Property catalog")
@ApiExtraModels(PublicRentalAvailabilityResponseDto)
@Controller("v1/public/properties/:propertyId/rental-availability")
@TenantContext("not-applicable")
export class PublicRentalAvailabilityController {
  constructor(
    @Inject(RETRIEVE_PUBLIC_RENTAL_AVAILABILITY)
    private readonly availability: Pick<RetrievePublicRentalAvailability, "execute">,
    @Inject(PUBLIC_CATALOG_TENANT_RESOLVER)
    private readonly tenantResolver: PublicCatalogTenantResolver,
  ) {}

  @Get()
  @ApiOperation({ operationId: "retrievePublicRentalAvailability", summary: "Evaluate sanitized availability for one published rental", security: [] })
  @ApiParam({ name: "propertyId", schema: { type: "string", format: "uuid" } })
  @ApiQuery({ name: "startsAt", schema: { type: "string", format: "date-time" } })
  @ApiQuery({ name: "endsAt", schema: { type: "string", format: "date-time" } })
  @ApiOkResponse({ type: PublicRentalAvailabilityResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid UTC half-open interval", content: problemContent() })
  @ApiResponse({ status: 404, description: "Published rental not found", content: problemContent() })
  @ZodSerializerDto(PublicRentalAvailabilityResponseDto)
  retrieve(
    @Headers("host") host: string | undefined,
    @Param() path: RentalAvailabilityPathDto,
    @Query() query: RentalAvailabilityQueryDto,
  ): Promise<PublicRentalAvailabilityResponse> {
    return this.availability.execute({
      tenantId: requirePublicCatalogTenant(this.tenantResolver, host), propertyId: path.propertyId,
      startsAt: query.startsAt, endsAt: query.endsAt,
    });
  }
}
