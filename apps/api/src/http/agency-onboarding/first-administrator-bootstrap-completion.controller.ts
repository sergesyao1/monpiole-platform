import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  GoneException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  createZodDto,
  ZodSerializerDto,
} from "nestjs-zod";
import {
  FirstAdministratorBootstrapNotCompletableError,
  FirstAdministratorBootstrapTokenExpiredError,
  FirstAdministratorBootstrapTokenNotFoundError,
  FirstAdministratorIdentityLinkConflictError,
  FirstAdministratorInvitedEmailVerificationError,
} from "@monpiole/agency-onboarding";

import type {
  FinalizeFirstAdministratorBootstrap,
} from "../../operations/finalize-first-administrator-bootstrap.js";

import {
  CompleteFirstAdministratorIdentityRequestSchema,
  CompleteFirstAdministratorIdentityResponseSchema,
  type CompleteFirstAdministratorIdentityResponse,
} from "../../contracts/v1/agency-onboarding/first-administrator.schema.js";
import type {
  VerifiedAuthenticationContextProvider,
} from "../../authentication/verified-authentication-context-provider.js";
import type {
  RequestWithContext,
} from "../request-context/request-context.js";
import {
  TenantContext,
} from "../request-context/request-context.decorator.js";

export const FINALIZE_FIRST_ADMINISTRATOR_BOOTSTRAP =
  Symbol("finalize-first-administrator-bootstrap");

export const VERIFIED_AUTHENTICATION_CONTEXT_PROVIDER =
  Symbol("verified-authentication-context-provider");

class CompleteFirstAdministratorIdentityRequestDto extends createZodDto(
  CompleteFirstAdministratorIdentityRequestSchema,
) {}

class CompleteFirstAdministratorIdentityResponseDto extends createZodDto(
  CompleteFirstAdministratorIdentityResponseSchema,
) {}

@ApiTags("Agency administrator bootstrap")
@Controller("v1/agency-administrator-bootstrap")
@TenantContext("not-applicable")
export class FirstAdministratorBootstrapCompletionController {
  public constructor(
    @Inject(FINALIZE_FIRST_ADMINISTRATOR_BOOTSTRAP)
    private readonly finalizeBootstrap: Pick<
      FinalizeFirstAdministratorBootstrap,
      "execute"
    >,

    @Inject(VERIFIED_AUTHENTICATION_CONTEXT_PROVIDER)
    private readonly authentication: VerifiedAuthenticationContextProvider,
  ) {}

  @Post("completions")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: "completeFirstAdministratorIdentity",
  })
  @ApiOkResponse({
    type: CompleteFirstAdministratorIdentityResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid bootstrap completion request",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid bearer authentication",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated email does not match the invited administrator",
  })
  @ApiNotFoundResponse({
    description: "Bootstrap token not found",
  })
  @ApiGoneResponse({
    description: "Bootstrap token expired",
  })
  @ApiConflictResponse({
    description:
      "Bootstrap is not completable or external identity provenance conflicts",
  })
  @ZodSerializerDto(CompleteFirstAdministratorIdentityResponseDto)
  public async complete(
    @Body() body: CompleteFirstAdministratorIdentityRequestDto,
    @Req() request: RequestWithContext,
  ): Promise<CompleteFirstAdministratorIdentityResponse> {
    const authentication =
      await this.authentication.resolve(request);

    if (authentication === undefined) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      return await this.finalizeBootstrap.execute({
        bootstrapToken: body.bootstrapToken,
        issuer: authentication.issuer,
        subject: authentication.subject,
        ...(authentication.email === undefined
          ? {}
          : { email: authentication.email }),
        emailVerified: authentication.emailVerified === true,
      });
    } catch (error) {
      if (error instanceof FirstAdministratorBootstrapTokenNotFoundError) {
        throw new NotFoundException({
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof FirstAdministratorBootstrapTokenExpiredError) {
        throw new GoneException({
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof FirstAdministratorInvitedEmailVerificationError) {
        throw new ForbiddenException({
          code: error.code,
          message: error.message,
        });
      }

      if (
        error instanceof FirstAdministratorBootstrapNotCompletableError ||
        error instanceof FirstAdministratorIdentityLinkConflictError
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