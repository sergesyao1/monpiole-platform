import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import {
  createZodDto,
  ZodSerializerDto,
} from "nestjs-zod";
import type {
  ListPropertyInquiryCommunications,
  PropertyInquiryCommunication,
  RecordPropertyInquiryCommunication,
} from "@monpiole/property-management";

import {
  PropertyInquiryCommunicationListQuerySchema,
  PropertyInquiryCommunicationListSchema,
  PropertyInquiryCommunicationPathSchema,
  PropertyInquiryCommunicationSchema,
  RecordPropertyInquiryCommunicationRequestSchema,
  type PropertyInquiryCommunicationList,
  type PropertyInquiryCommunicationResponse,
} from "../../contracts/v1/properties/property-inquiry-communication.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toPropertyAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import {
  REQUEST_CONTEXT,
  type RequestWithContext,
} from "../request-context/request-context.js";
import {
  TenantContext,
} from "../request-context/request-context.decorator.js";
import {
  decodePropertyInquiryCommunicationCursor,
  encodePropertyInquiryCommunicationCursor,
} from "./property-inquiry-communication-cursor.js";

export const RECORD_PROPERTY_INQUIRY_COMMUNICATION =
  Symbol("record-property-inquiry-communication");

export const LIST_PROPERTY_INQUIRY_COMMUNICATIONS =
  Symbol("list-property-inquiry-communications");

class PathDto extends createZodDto(
  PropertyInquiryCommunicationPathSchema,
) {}

class RecordDto extends createZodDto(
  RecordPropertyInquiryCommunicationRequestSchema,
) {}

class QueryDto extends createZodDto(
  PropertyInquiryCommunicationListQuerySchema,
) {}

class CommunicationDto extends createZodDto(
  PropertyInquiryCommunicationSchema,
) {}

class CommunicationListDto extends createZodDto(
  PropertyInquiryCommunicationListSchema,
) {}

@ApiTags("Property inquiry communications")
@ApiSecurity("bearer")
@Controller(
  "v1/properties/:propertyId/inquiries/:inquiryId/communications",
)
@TenantContext("not-applicable")
export class PropertyInquiryCommunicationsController {
  constructor(
    @Inject(RECORD_PROPERTY_INQUIRY_COMMUNICATION)
    private readonly record:
      Pick<RecordPropertyInquiryCommunication, "execute">,

    @Inject(LIST_PROPERTY_INQUIRY_COMMUNICATIONS)
    private readonly list:
      Pick<ListPropertyInquiryCommunications, "execute">,

    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly auth: AuthenticatedAuthorityProvider,
  ) {}

  private async authority(
    request: RequestWithContext,
  ) {
    return toPropertyAuthority(
      await requireAuthenticatedAuthority(
        this.auth,
        request,
      ),
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    operationId: "recordPropertyInquiryCommunication",
  })
  @ApiCreatedResponse({
    type: CommunicationDto,
  })
  @ZodSerializerDto(CommunicationDto)
  async create(
    @Param() path: PathDto,
    @Body() body: RecordDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyInquiryCommunicationResponse> {
    const context = request[REQUEST_CONTEXT];

    if (!context) {
      throw new Error("Request context missing");
    }

    const communication =
      await this.record.execute({
        authority: await this.authority(request),
        propertyId: path.propertyId,
        inquiryId: path.inquiryId,
        channel: body.channel,
        direction: body.direction,
        ...(body.summary === undefined
          ? {}
          : { summary: body.summary }),
        ...(body.occurredAt === undefined
          ? {}
          : { occurredAt: body.occurredAt }),
        correlationId: context.correlationId,
      });

    return view(communication);
  }

  @Get()
  @ApiOperation({
    operationId: "listPropertyInquiryCommunications",
  })
  @ApiOkResponse({
    type: CommunicationListDto,
  })
  @ZodSerializerDto(CommunicationListDto)
  async all(
    @Param() path: PathDto,
    @Query() query: QueryDto,
    @Req() request: RequestWithContext,
  ): Promise<PropertyInquiryCommunicationList> {
    const page = await this.list.execute({
      authority: await this.authority(request),
      propertyId: path.propertyId,
      inquiryId: path.inquiryId,
      limit: query.limit,
      ...(query.cursor === undefined
        ? {}
        : {
            cursor:
              decodePropertyInquiryCommunicationCursor(
                query.cursor,
              ),
          }),
    });

    return {
      items: page.items.map(view),
      pageInfo: {
        hasNextPage: page.nextCursor !== undefined,
        nextCursor:
          page.nextCursor === undefined
            ? null
            : encodePropertyInquiryCommunicationCursor(
                page.nextCursor,
              ),
      },
    };
  }
}

function view(
  communication: PropertyInquiryCommunication,
): PropertyInquiryCommunicationResponse {
  const values = communication.values;

  return {
    communicationId: values.communicationId,
    propertyId: values.propertyId,
    inquiryId: values.inquiryId,
    channel: values.channel,
    direction: values.direction,
    status: values.status,
    ...(values.summary === undefined
      ? {}
      : { summary: values.summary }),
    occurredAt: values.occurredAt,
    performedByActorId: values.performedByActorId,
    createdAt: values.createdAt,
  };
}