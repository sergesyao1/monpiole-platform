import { Controller, Get, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  requireAuthenticatedAuthority,
  type AuthenticatedAuthorityProvider,
} from "../authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../request-context/request-context.js";

interface AuthenticationSessionResponse {
  readonly authenticated: true;
}

@ApiTags("Authentication")
@Controller("v1/authentication/session")
export class AuthenticationSessionController {
  constructor(
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER)
    private readonly authorityProvider: AuthenticatedAuthorityProvider,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    operationId: "verifyAuthenticationSession",
    summary: "Verify OIDC authentication and internal authority resolution",
  })
  @ApiOkResponse({
    description: "The external identity resolves to an active MonPiole authority",
    schema: {
      type: "object",
      required: ["authenticated"],
      properties: { authenticated: { type: "boolean", enum: [true] } },
      additionalProperties: false,
    },
  })
  @ApiResponse({ status: 401, description: "Missing, invalid, or unresolved authentication" })
  async execute(@Req() request: RequestWithContext): Promise<AuthenticationSessionResponse> {
    await requireAuthenticatedAuthority(this.authorityProvider, request);
    return { authenticated: true };
  }
}
