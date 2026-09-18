import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type {
  SubmitAgencyRegistration,
} from "@monpiole/agency-onboarding";
import {
  createZodDto,
  ZodSerializerDto,
} from "nestjs-zod";

import {
  SubmitAgencyRegistrationRequestSchema,
  SubmitAgencyRegistrationResponseSchema,
  type SubmitAgencyRegistrationResponse,
} from "../../contracts/v1/agency-onboarding/agency-registration.schema.js";
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

class SubmitAgencyRegistrationRequestDto extends createZodDto(
  SubmitAgencyRegistrationRequestSchema,
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
    @Body() body: SubmitAgencyRegistrationRequestDto,
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
}