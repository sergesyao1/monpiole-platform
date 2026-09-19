import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
interface HeaderResponse {
  setHeader(
    name: string,
    value: string,
  ): void;
}
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
  AgencyRegistration,
  ApproveAgencyRegistration,
  ListAgencyRegistrations,
  RejectAgencyRegistration,
  RetrieveAgencyRegistration,
  RetrieveAgencyRegistrationDocumentContent,
  StartAgencyRegistrationReview,
} from "@monpiole/agency-onboarding";

import {
  AgencyRegistrationDetailsSchema,
  AgencyRegistrationDocumentListSchema,
  AgencyRegistrationDocumentPathSchema,
  AgencyRegistrationListSchema,
  AgencyRegistrationPathSchema,
  AgencyRegistrationSchema,
  RejectAgencyRegistrationRequestSchema,
  type AgencyRegistrationDetailsResponse,
  type AgencyRegistrationDocumentList,
  type AgencyRegistrationList,
  type AgencyRegistrationResponse,
} from "../../contracts/v1/agency-onboarding/agency-registration.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toAgencyOnboardingAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import {
  REQUEST_CONTEXT,
  type RequestWithContext,
} from "../request-context/request-context.js";
import {
  TenantContext,
} from "../request-context/request-context.decorator.js";

export const LIST_AGENCY_REGISTRATIONS = Symbol(
  "list-agency-registrations",
);
export const RETRIEVE_AGENCY_REGISTRATION = Symbol(
  "retrieve-agency-registration",
);
export const RETRIEVE_AGENCY_REGISTRATION_DOCUMENT_CONTENT =
  Symbol("retrieve-agency-registration-document-content");
export const START_AGENCY_REGISTRATION_REVIEW = Symbol(
  "start-agency-registration-review",
);
export const REJECT_AGENCY_REGISTRATION = Symbol(
  "reject-agency-registration",
);
export const APPROVE_AGENCY_REGISTRATION = Symbol(
  "approve-agency-registration",
);

class RegistrationPathDto extends createZodDto(
  AgencyRegistrationPathSchema,
) {}

class RegistrationDocumentPathDto extends createZodDto(
  AgencyRegistrationDocumentPathSchema,
) {}

class RejectDto extends createZodDto(
  RejectAgencyRegistrationRequestSchema,
) {}

class RegistrationDto extends createZodDto(
  AgencyRegistrationSchema,
) {}

class RegistrationDetailsDto extends createZodDto(
  AgencyRegistrationDetailsSchema,
) {}

class RegistrationListDto extends createZodDto(
  AgencyRegistrationListSchema,
) {}

class RegistrationDocumentListDto extends createZodDto(
  AgencyRegistrationDocumentListSchema,
) {}

@ApiTags("Agency registrations")
@Controller("v1/platform/agency-registrations")
@TenantContext("not-applicable")
export class PlatformAgencyRegistrationsController {
  public constructor(

    @Inject(LIST_AGENCY_REGISTRATIONS)
    private readonly list: Pick<
      ListAgencyRegistrations,
      "execute"
    >,

    @Inject(RETRIEVE_AGENCY_REGISTRATION)
    private readonly retrieve: Pick<
      RetrieveAgencyRegistration,
      "execute"
    >,

    @Inject(RETRIEVE_AGENCY_REGISTRATION_DOCUMENT_CONTENT)
    private readonly retrieveDocumentContent: Pick<
      RetrieveAgencyRegistrationDocumentContent,
      "execute"
    >,

    @Inject(START_AGENCY_REGISTRATION_REVIEW)
    private readonly startReview: Pick<
      StartAgencyRegistrationReview,
      "execute"
    >,

    @Inject(REJECT_AGENCY_REGISTRATION)
    private readonly reject: Pick<
      RejectAgencyRegistration,
      "execute"
    >,

    @Inject(APPROVE_AGENCY_REGISTRATION)
    private readonly approve: Pick<
      ApproveAgencyRegistration,
      "execute"
    >,

    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly auth: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "listAgencyRegistrations",
  })
  @ApiOkResponse({
    type: RegistrationListDto,
  })
  @ZodSerializerDto(RegistrationListDto)
  public async all(
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationList> {
    const registrations = await this.list.execute({
      authority: await this.agencyAuthority(request),
    });

    return {
      items: registrations.map(view),
    };
  }

  @Get(":registrationId")
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "retrieveAgencyRegistration",
  })
  @ApiOkResponse({
    type: RegistrationDetailsDto,
  })
  @ZodSerializerDto(RegistrationDetailsDto)
  public async one(
    @Param() path: RegistrationPathDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationDetailsResponse> {
    const details = await this.retrieve.execute({
      authority: await this.agencyAuthority(request),
      registrationId: path.registrationId,
    });

    return {
      ...view(details.registration),

      documents: details.documents.map((document) => ({
        documentId: document.documentId,
        documentType: document.documentType,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        checksumSha256: document.checksumSha256,
        createdAt: document.createdAt,
      })),
      ...(details.firstAdministrator === undefined
        ? {}
        : { firstAdministrator: details.firstAdministrator }),
    };
  }

  @Get(":registrationId/documents")
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "listAgencyRegistrationDocuments",
  })
  @ApiOkResponse({
    type: RegistrationDocumentListDto,
  })
  @ZodSerializerDto(RegistrationDocumentListDto)
  public async documents(
    @Param() path: RegistrationPathDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationDocumentList> {
    const details = await this.retrieve.execute({
      authority: await this.agencyAuthority(request),
      registrationId: path.registrationId,
    });

    return {
      items: details.documents.map((document) => ({
        documentId: document.documentId,
        documentType: document.documentType,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        checksumSha256: document.checksumSha256,
        createdAt: document.createdAt,
      })),
    };
  }
  @Get(":registrationId/documents/:documentId/content")
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "retrieveAgencyRegistrationDocumentContent",
  })
  public async documentContent(
    @Param() path: RegistrationDocumentPathDto,
    @Req() request: RequestWithContext,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<StreamableFile> {
    const result =
      await this.retrieveDocumentContent.execute({
        authority: await this.agencyAuthority(request),
        registrationId: path.registrationId,
        documentId: path.documentId,
      });

    const filename = safeAttachmentFilename(
      result.document.originalFilename,
    );

    response.setHeader(
      "Content-Type",
      result.document.mimeType,
    );
    response.setHeader(
      "Content-Length",
      result.document.sizeBytes.toString(),
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    response.setHeader(
      "ETag",
      `"${result.document.checksumSha256}"`,
    );
    response.setHeader(
      "X-Content-Type-Options",
      "nosniff",
    );
    response.setHeader(
      "Cache-Control",
      "private, no-store",
    );

    return new StreamableFile(
      Buffer.from(result.content),
    );
  }

  @Post(":registrationId/review")
  @HttpCode(200)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "startAgencyRegistrationReview",
  })
  @ApiOkResponse({
    type: RegistrationDto,
  })
  @ZodSerializerDto(RegistrationDto)
  public async review(
    @Param() path: RegistrationPathDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationResponse> {
    return view(
      await this.startReview.execute({
        authority: await this.agencyAuthority(request),
        registrationId: path.registrationId,
      }),
    );
  }

  @Post(":registrationId/reject")
  @HttpCode(200)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "rejectAgencyRegistration",
  })
  @ApiOkResponse({
    type: RegistrationDto,
  })
  @ZodSerializerDto(RegistrationDto)
  public async rejectRegistration(
    @Param() path: RegistrationPathDto,
    @Body() body: RejectDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationResponse> {
    return view(
      await this.reject.execute({
        authority: await this.agencyAuthority(request),
        registrationId: path.registrationId,
        rejectionReason: body.rejectionReason,
      }),
    );
  }

  @Post(":registrationId/approve")
  @HttpCode(200)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "approveAgencyRegistration",
  })
  @ApiOkResponse({
    type: RegistrationDto,
  })
  @ZodSerializerDto(RegistrationDto)
  public async approveRegistration(
    @Param() path: RegistrationPathDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationResponse> {
    return view(
      await this.approve.execute({
        authority: await this.agencyAuthority(request),
        registrationId: path.registrationId,
      }),
    );
  }

  private async agencyAuthority(
    request: RequestWithContext,
  ) {
    return toAgencyOnboardingAuthority(
      await requireAuthenticatedAuthority(
        this.auth,
        request,
      ),
    );
  }
}

function safeAttachmentFilename(
  filename: string,
): string {
  const normalized = filename
    .replace(/[\r\n"]/gu, "_")
    .replace(/[\\/]/gu, "_")
    .trim();

  return normalized.length === 0
    ? "document"
    : normalized;
}

function view(
  registration: AgencyRegistration,
): AgencyRegistrationResponse {
  return {
    registrationId: registration.id,
    status: registration.status,

    agencyLegalName: registration.agencyLegalName,
    ...(registration.agencyTradeName === undefined
      ? {}
      : { agencyTradeName: registration.agencyTradeName }),
    registrationNumber: registration.registrationNumber,
    ...(registration.taxIdentifier === undefined
      ? {}
      : { taxIdentifier: registration.taxIdentifier }),

    phone: registration.phone,
    email: registration.email,
    ...(registration.website === undefined
      ? {}
      : { website: registration.website }),

    address: registration.address,
    city: registration.city,
    countryCode: registration.countryCode,

    contactFirstName: registration.contactFirstName,
    contactLastName: registration.contactLastName,
    contactEmail: registration.contactEmail,
    contactPhone: registration.contactPhone,

    submittedAt: registration.submittedAt,

    ...(registration.reviewStartedAt === undefined
      ? {}
      : { reviewStartedAt: registration.reviewStartedAt }),

    ...(registration.reviewedByIdentityId === undefined
      ? {}
      : {
          reviewedByIdentityId:
            registration.reviewedByIdentityId,
        }),

    ...(registration.approvedAt === undefined
      ? {}
      : { approvedAt: registration.approvedAt }),

    ...(registration.rejectedAt === undefined
      ? {}
      : { rejectedAt: registration.rejectedAt }),

    ...(registration.rejectionReason === undefined
      ? {}
      : { rejectionReason: registration.rejectionReason }),

    ...(registration.approvalProvisioningStartedAt === undefined
      ? {}
      : {
          approvalProvisioningStartedAt:
            registration.approvalProvisioningStartedAt,
        }),

    ...(registration.provisionedTenantId === undefined
      ? {}
      : {
          provisionedTenantId:
            registration.provisionedTenantId,
        }),

    correlationId: registration.correlationId,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}
