import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type {
  UploadAgencyRegistrationDocument,
} from "@monpiole/agency-onboarding";
import {
  createZodDto,
  ZodSerializerDto,
} from "nestjs-zod";

import {
  UploadAgencyRegistrationDocumentResponseSchema,
  type UploadAgencyRegistrationDocumentResponse,
} from "../../contracts/v1/agency-onboarding/agency-registration.schema.js";
import {
  TenantContext,
} from "../request-context/request-context.decorator.js";

export const UPLOAD_AGENCY_REGISTRATION_DOCUMENT = Symbol(
  "upload-agency-registration-document",
);

class UploadDocumentResponseDto extends createZodDto(
  UploadAgencyRegistrationDocumentResponseSchema,
) {}

interface UploadedAgencyRegistrationFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly buffer: Buffer;
}

@ApiTags("Agency registrations")
@Controller("v1/agency-registration-documents")
@TenantContext("not-applicable")
export class AgencyRegistrationDocumentsController {
  public constructor(
    @Inject(UPLOAD_AGENCY_REGISTRATION_DOCUMENT)
    private readonly uploadDocument: Pick<
      UploadAgencyRegistrationDocument,
      "execute"
    >,
  ) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiOperation({
    operationId: "uploadAgencyRegistrationDocument",
    security: [],
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: UploadDocumentResponseDto,
  })
  @ZodSerializerDto(UploadDocumentResponseDto)
  public async post(
    @UploadedFile()
    file: UploadedAgencyRegistrationFile | undefined,
  ): Promise<UploadAgencyRegistrationDocumentResponse> {
    if (file === undefined) {
      throw new BadRequestException(
        "Agency registration document file is required",
      );
    }

    return this.uploadDocument.execute({
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      content: file.buffer,
    });
  }
}