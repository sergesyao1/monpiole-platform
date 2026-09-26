import { Body, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { SubmitAgencyRegistration } from "@monpiole/agency-onboarding";
import { createZodDto, ZodSerializerDto } from "nestjs-zod";

import {
  SubmitAgencyRegistrationResponseSchema,
  SubmitOrganizationRegistrationRequestSchema,
  type SubmitAgencyRegistrationResponse,
} from "../../contracts/v1/agency-onboarding/agency-registration.schema.js";
import { REQUEST_CONTEXT, type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { SUBMIT_AGENCY_REGISTRATION } from "./agency-registrations.controller.js";

class SubmitOrganizationRegistrationRequestDto extends createZodDto(
  SubmitOrganizationRegistrationRequestSchema,
) {}

class SubmitResponseDto extends createZodDto(
  SubmitAgencyRegistrationResponseSchema,
) {}

@ApiTags("Organization registrations")
@Controller("v1/organization-registrations")
@TenantContext("not-applicable")
export class OrganizationRegistrationsController {
  public constructor(
    @Inject(SUBMIT_AGENCY_REGISTRATION)
    private readonly submit: Pick<SubmitAgencyRegistration, "execute">,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: "submitOrganizationRegistration", security: [] })
  @ApiCreatedResponse({ type: SubmitResponseDto })
  @ZodSerializerDto(SubmitResponseDto)
  public async post(
    @Body() body: SubmitOrganizationRegistrationRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<SubmitAgencyRegistrationResponse> {
    const context = request[REQUEST_CONTEXT];
    if (context === undefined) throw new Error("Request context missing");

    const { legalName, tradeName, ...input } = body;
    const result = await this.submit.execute({
      ...input,
      agencyLegalName: legalName,
      ...(tradeName === undefined ? {} : { agencyTradeName: tradeName }),
      correlationId: context.correlationId,
    });

    return {
      registrationId: result.registration.id,
      status: "SUBMITTED",
      submittedAt: result.registration.submittedAt,
    };
  }
}
