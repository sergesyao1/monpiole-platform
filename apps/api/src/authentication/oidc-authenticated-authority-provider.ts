import type {
  AuthenticatedAuthority,
  AuthenticatedAuthorityProvider,
} from "../http/authenticated-authority/authenticated-authority.js";
import type { RequestWithContext } from "../http/request-context/request-context.js";
import type { OidcAccessTokenVerifier } from "./oidc-access-token-verifier.js";
import type { VerifiedAuthenticationContext } from "./verified-authentication-context.js";

export interface ExternalIdentityAuthorityResolver {
  resolve(context: VerifiedAuthenticationContext): Promise<AuthenticatedAuthority | undefined>;
}

export class OidcAuthenticatedAuthorityProvider implements AuthenticatedAuthorityProvider {
  constructor(
    private readonly tokens: Pick<OidcAccessTokenVerifier, "verify">,
    private readonly identities: ExternalIdentityAuthorityResolver,
  ) {}

  async resolve(request: RequestWithContext): Promise<AuthenticatedAuthority | undefined> {
    const token = bearerToken(request.headers.authorization);
    if (token === undefined) return undefined;
    try {
      const verified = await this.tokens.verify(token);
      return await this.identities.resolve(verified);
    } catch {
      return undefined;
    }
  }
}

function bearerToken(header: string | string[] | undefined): string | undefined {
  if (typeof header !== "string") return undefined;
  const match = /^Bearer ([^\s]+)$/u.exec(header);
  return match?.[1];
}
