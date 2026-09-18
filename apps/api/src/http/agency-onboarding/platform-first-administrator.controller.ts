import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import {
  createZodDto,
  ZodSerializerDto,
} from "nestjs-zod";
import {
  FirstAdministratorAlreadyExistsError,
  FirstAdministratorRegistrationNotFoundError,
  FirstAdministratorRegistrationNotReadyError,
  type CreateFirstAgencyAdministrator,
} from "@monpiole/agency-onboarding";

import { agencyFirstAdministratorCorrelationId } from "../../composition/agency-first-administrator-correlation.js";
import {
  CreateFirstAgencyAdministratorPathSchema,
  CreateFirstAgencyAdministratorRequestSchema,
  CreateFirstAgencyAdministratorResponseSchema,
  type CreateFirstAgencyAdministratorRequest,
  type CreateFirstAgencyAdministratorResponse,
} from "../../contracts/v1/agency-onboarding/first-administrator.schema.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toAgencyOnboardingAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import {
  type RequestWithContext,
} from "../request-context/request-context.js";
import {
  TenantContext,
} from "../request-context/request-context.decorator.js";

export const CREATE_FIRST_AGENCY_ADMINISTRATOR =
  Symbol("create-first-agency-administrator");

class CreateFirstAdministratorPathDto extends createZodDto(
  CreateFirstAgencyAdministratorPathSchema,
) {}
class CreateFirstAdministratorRequestDto extends createZodDto(
  CreateFirstAgencyAdministratorRequestSchema,
) {}

class CreateFirstAdministratorResponseDto extends createZodDto(
  CreateFirstAgencyAdministratorResponseSchema,
) {}

@ApiTags("Agency registrations")
@Controller("v1/platform/agency-registrations")
@TenantContext("not-applicable")
export class PlatformFirstAdministratorController {
  public constructor(
    @Inject(CREATE_FIRST_AGENCY_ADMINISTRATOR)
    private readonly createFirstAdministrator: Pick<
      CreateFirstAgencyAdministrator,
      "execute"
    >,

    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly auth: AuthenticatedAuthorityProvider,
  ) {}

  @Post(":registrationId/first-administrator")
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "createFirstAgencyAdministrator",
  })
  @ApiCreatedResponse({
    type: CreateFirstAdministratorResponseDto,
  })
  @ZodSerializerDto(CreateFirstAdministratorResponseDto)
  public async create(
    @Param() path: CreateFirstAdministratorPathDto,
    @Body() body: CreateFirstAdministratorRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<CreateFirstAgencyAdministratorResponse> {
    let correlationId: string;

    try {
      correlationId =
        agencyFirstAdministratorCorrelationId(path.registrationId);
    } catch {
      throw new BadRequestException({
        code: "INVALID_AGENCY_REGISTRATION_ID",
        message: "The agency registration identifier is invalid.",
      });
    }

    try {
      return await this.createFirstAdministrator.execute({
        registrationId: path.registrationId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        correlationId,
        authority: toAgencyOnboardingAuthority(
          await requireAuthenticatedAuthority(
            this.auth,
            request,
          ),
        ),
      });
    } catch (error) {
      if (
        error instanceof
        FirstAdministratorRegistrationNotFoundError
      ) {
        throw new NotFoundException({
          code: error.code,
          message: error.message,
        });
      }

      if (
        error instanceof
        FirstAdministratorRegistrationNotReadyError
      ) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      }

      if (
        error instanceof
        FirstAdministratorAlreadyExistsError
      ) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }
}