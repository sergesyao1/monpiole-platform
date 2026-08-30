import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, Res, StreamableFile } from "@nestjs/common";
import { ApiCreatedResponse, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type {
  DeletePropertyPhoto, ListPropertyPhotos, RegisterPropertyPhoto,
  RetrievePropertyPhotoContent, SelectPropertyPrimaryPhoto,
} from "@monpiole/property-management";
import { ZodSerializerDto } from "nestjs-zod";

import type { PropertyPhotoGalleryResponse } from "../../contracts/v1/properties/property.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toPropertyAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { problemContent, responseHeaders } from "./create-property.controller.js";
import {
  PropertyPhotoGalleryResponseDto, PropertyPhotoPathDto, PropertyProblemDetailsDto,
  RegisterPropertyPhotoRequestDto, RetrievePropertyPathDto,
} from "./property.dto.js";
import { toPropertyPhotoGalleryResponse } from "./property.mapper.js";

export const LIST_PROPERTY_PHOTOS_USE_CASE = Symbol("monpiole.list-property-photos-use-case");
export const REGISTER_PROPERTY_PHOTO_USE_CASE = Symbol("monpiole.register-property-photo-use-case");
export const RETRIEVE_PROPERTY_PHOTO_CONTENT_USE_CASE = Symbol("monpiole.retrieve-property-photo-content-use-case");
export const SELECT_PROPERTY_PRIMARY_PHOTO_USE_CASE = Symbol("monpiole.select-property-primary-photo-use-case");
export const DELETE_PROPERTY_PHOTO_USE_CASE = Symbol("monpiole.delete-property-photo-use-case");

@ApiTags("Property photos") @ApiExtraModels(PropertyProblemDetailsDto)
@Controller("v1/properties/:propertyId/photos")
export class PropertyPhotosController {
  constructor(
    @Inject(LIST_PROPERTY_PHOTOS_USE_CASE) private readonly listPhotos: Pick<ListPropertyPhotos, "execute">,
    @Inject(REGISTER_PROPERTY_PHOTO_USE_CASE) private readonly registerPhoto: Pick<RegisterPropertyPhoto, "execute">,
    @Inject(RETRIEVE_PROPERTY_PHOTO_CONTENT_USE_CASE) private readonly retrieveContent: Pick<RetrievePropertyPhotoContent, "execute">,
    @Inject(SELECT_PROPERTY_PRIMARY_PHOTO_USE_CASE) private readonly selectPrimary: Pick<SelectPropertyPrimaryPhoto, "execute">,
    @Inject(DELETE_PROPERTY_PHOTO_USE_CASE) private readonly deletePhoto: Pick<DeletePropertyPhoto, "execute">,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get() @TenantContext("not-applicable")
  @ApiOperation({ operationId: "listPropertyPhotos", summary: "List available photos of a tenant-owned Property" })
  @ApiSecurity("bearer") @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ type: PropertyPhotoGalleryResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyPhotoGalleryResponseDto)
  async list(@Param() path: RetrievePropertyPathDto, @Req() request: RequestWithContext): Promise<PropertyPhotoGalleryResponse> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyPhotoGalleryResponse(await this.listPhotos.execute({
      propertyId: path.propertyId, authority: toPropertyAuthority(authenticated),
    }));
  }

  @Post() @HttpCode(201) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "registerPropertyPhoto", summary: "Persist photo content and register an available Property photo" })
  @ApiSecurity("bearer") @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiCreatedResponse({ type: PropertyPhotoGalleryResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid photo content", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyPhotoGalleryResponseDto)
  async register(
    @Param() path: RetrievePropertyPathDto,
    @Body() body: RegisterPropertyPhotoRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyPhotoGalleryResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyPhotoGalleryResponse(await this.registerPhoto.execute({
      propertyId: path.propertyId, category: body.category, contentType: body.contentType,
      contentBase64: body.contentBase64, correlationId: context.correlationId,
      authority: toPropertyAuthority(authenticated),
    }));
  }

  @Get(":photoId/content") @TenantContext("not-applicable")
  @ApiOperation({ operationId: "retrievePropertyPhotoContent", summary: "Retrieve persisted private Property photo content" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "photoId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiResponse({ status: 200, description: "Persisted image content", content: {
    "image/jpeg": { schema: { type: "string", format: "binary" } },
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/webp": { schema: { type: "string", format: "binary" } },
  }, headers: responseHeaders() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ApiResponse({ status: 404, description: "Photo not found", content: problemContent() })
  async content(
    @Param() path: PropertyPhotoPathDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string | number): void },
  ): Promise<StreamableFile> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    const content = await this.retrieveContent.execute({
      propertyId: path.propertyId, photoId: path.photoId, authority: toPropertyAuthority(authenticated),
    });
    response.setHeader("Content-Type", content.contentType);
    response.setHeader("Content-Length", content.contentByteSize);
    response.setHeader("ETag", `\"${content.contentSha256}\"`);
    return new StreamableFile(Buffer.from(content.contentBase64, "base64"));
  }

  @Put(":photoId/primary") @HttpCode(200) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "selectPropertyPrimaryPhoto", summary: "Atomically select or replace the primary Property photo" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "photoId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ type: PropertyPhotoGalleryResponseDto, headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property or photo not found", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  @ZodSerializerDto(PropertyPhotoGalleryResponseDto)
  async select(@Param() path: PropertyPhotoPathDto, @Req() request: RequestWithContext): Promise<PropertyPhotoGalleryResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context was not established");
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    return toPropertyPhotoGalleryResponse(await this.selectPrimary.execute({
      propertyId: path.propertyId, photoId: path.photoId, correlationId: context.correlationId,
      authority: toPropertyAuthority(authenticated),
    }));
  }

  @Delete(":photoId") @HttpCode(204) @TenantContext("not-applicable")
  @ApiOperation({ operationId: "deletePropertyPhoto", summary: "Delete a non-primary Property photo" })
  @ApiSecurity("bearer")
  @ApiParam({ name: "propertyId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "photoId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiNoContentResponse({ description: "Non-primary photo deleted", headers: responseHeaders() })
  @ApiResponse({ status: 400, description: "Invalid identifier", content: problemContent() })
  @ApiResponse({ status: 401, description: "Authentication required", content: problemContent() })
  @ApiResponse({ status: 403, description: "Forbidden", content: problemContent() })
  @ApiResponse({ status: 404, description: "Property or photo not found", content: problemContent() })
  @ApiResponse({ status: 409, description: "Primary photo requires a replacement", content: problemContent() })
  @ApiResponse({ status: 500, description: "Safe internal failure", content: problemContent() })
  async remove(@Param() path: PropertyPhotoPathDto, @Req() request: RequestWithContext): Promise<void> {
    const authenticated = await requireAuthenticatedAuthority(this.authorityProvider, request);
    await this.deletePhoto.execute({ propertyId: path.propertyId, photoId: path.photoId, authority: toPropertyAuthority(authenticated) });
  }
}
