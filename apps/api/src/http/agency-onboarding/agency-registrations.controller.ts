import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
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
  AgencyRegistration,
  ApproveAgencyRegistration,
  ListAgencyRegistrations,
  RejectAgencyRegistration,
  RetrieveAgencyRegistration,
  StartAgencyRegistrationReview,
  SubmitAgencyRegistration,
} from "@monpiole/agency-onboarding";

import {
  AgencyRegistrationListSchema,
  AgencyRegistrationPathSchema,
  AgencyRegistrationSchema,
  RejectAgencyRegistrationRequestSchema,
  SubmitAgencyRegistrationRequestSchema,
  SubmitAgencyRegistrationResponseSchema,
  type AgencyRegistrationList,
  type AgencyRegistrationResponse,
  type SubmitAgencyRegistrationResponse,
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

export const SUBMIT_AGENCY_REGISTRATION = Symbol(
  "submit-agency-registration",
);
export const LIST_AGENCY_REGISTRATIONS = Symbol(
  "list-agency-registrations",
);
export const RETRIEVE_AGENCY_REGISTRATION = Symbol(
  "retrieve-agency-registration",
);
export const START_AGENCY_REGISTRATION_REVIEW = Symbol(
  "start-agency-registration-review",
);
export const REJECT_AGENCY_REGISTRATION = Symbol(
  "reject-agency-registration",
);
export const APPROVE_AGENCY_REGISTRATION = Symbol(
  "approve-agency-registration",
);

class SubmitDto extends createZodDto(
  SubmitAgencyRegistrationRequestSchema,
) {}

class RegistrationPathDto extends createZodDto(
  AgencyRegistrationPathSchema,
) {}

class RejectDto extends createZodDto(
  RejectAgencyRegistrationRequestSchema,
) {}

class RegistrationDto extends createZodDto(
  AgencyRegistrationSchema,
) {}

class RegistrationListDto extends createZodDto(
  AgencyRegistrationListSchema,
) {}

class SubmitResponseDto extends createZodDto(
  SubmitAgencyRegistrationResponseSchema,
) {}

@ApiTags("Agency registrations")
@Controller("v1/agency-registrations")
@TenantContext("not-applicable")
export class AgencyRegistrationsController {
  public constructor(
    @Inject(SUBMIT_AGENCY_REGISTRATION)
    private readonly submit: Pick<
      SubmitAgencyRegistration,
      "execute"
    >,

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

  @Post()
  @HttpCode(201)
  @ApiOperation({
    operationId: "submitAgencyRegistration",
    security: [],
  })
  @ApiCreatedResponse({
    type: SubmitResponseDto,
  })
  @ZodSerializerDto(SubmitResponseDto)
  public async post(
    @Body() body: SubmitDto,
    @Req() request: RequestWithContext,
  ): Promise<SubmitAgencyRegistrationResponse> {
    const context = request[REQUEST_CONTEXT];

    if (context === undefined) {
      throw new Error("Request context missing");
    }

    const result = await this.submit.execute({
      ...body,
      correlationId: context.correlationId,
    });

    return {
      registrationId: result.registration.id,
      status: "SUBMITTED",
      submittedAt: result.registration.submittedAt,
    };
  }

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
    type: RegistrationDto,
  })
  @ZodSerializerDto(RegistrationDto)
  public async one(
    @Param() path: RegistrationPathDto,
    @Req() request: RequestWithContext,
  ): Promise<AgencyRegistrationResponse> {
    return view(
      await this.retrieve.execute({
        authority: await this.agencyAuthority(request),
        registrationId: path.registrationId,
      }),
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
