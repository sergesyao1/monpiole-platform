import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  AgencyOnboardingForbiddenError,
  authorizeAgencyOnboarding,
} from "@monpiole/agency-onboarding";

import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  toAgencyOnboardingAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type {
  RequestWithContext,
} from "../request-context/request-context.js";

@ApiTags("Authentication")
@Controller(
  "v1/authentication/authorization/platform-agency-registration-read",
)
export class PlatformAgencyRegistrationReadAuthorizationProbeController {
  public constructor(
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: "probePlatformAgencyRegistrationReadAuthorization",
    summary:
      "Probe agency registration read authorization without side effects",
  })
  @ApiNoContentResponse({
    description:
      "The authenticated authority may retrieve agency registrations",
  })
  @ApiResponse({
    status: 401,
    description: "Missing, invalid, or unresolved authentication",
  })
  @ApiResponse({
    status: 403,
    description:
      "Authenticated authority lacks RETRIEVE_AGENCY_REGISTRATIONS",
  })
  public async execute(
    @Req() request: RequestWithContext,
  ): Promise<void> {
    const authenticated = await requireAuthenticatedAuthority(
      this.authorityProvider,
      request,
    );

    try {
      authorizeAgencyOnboarding(
        toAgencyOnboardingAuthority(authenticated),
        "RETRIEVE_AGENCY_REGISTRATIONS",
      );
    } catch (error) {
      if (error instanceof AgencyOnboardingForbiddenError) {
        throw new ForbiddenException(
          "Platform agency registration read is forbidden",
        );
      }

      throw error;
    }
  }
}