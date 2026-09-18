import type { RequestWithContext } from "../http/request-context/request-context.js";
import type { OidcAccessTokenVerifier } from "./oidc-access-token-verifier.js";
import type { VerifiedAuthenticationContext } from "./verified-authentication-context.js";

export interface VerifiedAuthenticationContextProvider {
  resolve(
    request: RequestWithContext,
  ): Promise<VerifiedAuthenticationContext | undefined>;
}

export class OidcVerifiedAuthenticationContextProvider
  implements VerifiedAuthenticationContextProvider
{
  public constructor(
    private readonly tokens: Pick<OidcAccessTokenVerifier, "verify">,
  ) {}

  public async resolve(
    request: RequestWithContext,
  ): Promise<VerifiedAuthenticationContext | undefined> {
    const token = bearerToken(request.headers.authorization);

    if (token === undefined) {
      return undefined;
    }

    try {
      return await this.tokens.verify(token);
    } catch {
      return undefined;
    }
  }
}

function bearerToken(
  header: string | string[] | undefined,
): string | undefined {
  if (typeof header !== "string") {
    return undefined;
  }

  const match = /^Bearer ([^\s]+)$/u.exec(header);
  return match?.[1];
}