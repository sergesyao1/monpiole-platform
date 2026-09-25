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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
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
  type ReissueFirstAdministratorBootstrap,
} from "@monpiole/agency-onboarding";

import { agencyFirstAdministratorCorrelationId } from "../../composition/agency-first-administrator-correlation.js";
import {
  CreateFirstAgencyAdministratorPathSchema,
  CreateFirstAgencyAdministratorRequestSchema,
  CreateFirstAgencyAdministratorResponseSchema,
  type CreateFirstAgencyAdministratorRequest,
  type CreateFirstAgencyAdministratorResponse,
  ReissueFirstAdministratorBootstrapResponseSchema,
  type ReissueFirstAdministratorBootstrapResponse,
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
export const REISSUE_FIRST_ADMINISTRATOR_BOOTSTRAP =
  Symbol("reissue-first-administrator-bootstrap");

class CreateFirstAdministratorPathDto extends createZodDto(
  CreateFirstAgencyAdministratorPathSchema,
) {}
class CreateFirstAdministratorRequestDto extends createZodDto(
  CreateFirstAgencyAdministratorRequestSchema,
) {}

class CreateFirstAdministratorResponseDto extends createZodDto(
  CreateFirstAgencyAdministratorResponseSchema,
) {}
class ReissueFirstAdministratorBootstrapResponseDto extends createZodDto(
  ReissueFirstAdministratorBootstrapResponseSchema,
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

    @Inject(REISSUE_FIRST_ADMINISTRATOR_BOOTSTRAP)
    private readonly reissueFirstAdministrator: Pick<
      ReissueFirstAdministratorBootstrap,
      "execute"
    >,

    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly auth: AuthenticatedAuthorityProvider,
  ) {}

  @Post(":registrationId/first-administrator/reinvitation")
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "reissueFirstAdministratorBootstrap",
    description:
      "Rotates a pending first-administrator invitation. The previous link becomes invalid and the returned token is sensitive one-time material.",
  })
  @ApiCreatedResponse({
    type: ReissueFirstAdministratorBootstrapResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid registration identifier" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer authentication" })
  @ApiForbiddenResponse({ description: "Platform authorization required" })
  @ApiNotFoundResponse({ description: "Agency registration or first administrator not found" })
  @ApiConflictResponse({ description: "Registration or first administrator is not eligible for reinvitation" })
  @ZodSerializerDto(ReissueFirstAdministratorBootstrapResponseDto)
  public async reissue(
    @Param() path: CreateFirstAdministratorPathDto,
    @Req() request: RequestWithContext,
  ): Promise<ReissueFirstAdministratorBootstrapResponse> {
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

    return this.reissueFirstAdministrator.execute({
      registrationId: path.registrationId,
      correlationId,
      authority: toAgencyOnboardingAuthority(
        await requireAuthenticatedAuthority(this.auth, request),
      ),
    });
  }

  @Post(":registrationId/first-administrator")
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity("bearer")
  @ApiOperation({
    operationId: "createFirstAgencyAdministrator",
  })
  @ApiCreatedResponse({
    type: CreateFirstAdministratorResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid registration identifier or request" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer authentication" })
  @ApiForbiddenResponse({ description: "Platform authorization required" })
  @ApiNotFoundResponse({ description: "Agency registration not found" })
  @ApiConflictResponse({ description: "Registration is not ready or first administrator already exists" })
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
