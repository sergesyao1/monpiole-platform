import type {
  AuthenticatedAuthority,
  AuthorityGrant,
} from "../http/authenticated-authority/authenticated-authority.js";
import type {
  ExternalIdentityAuthorityResolver,
} from "./oidc-authenticated-authority-provider.js";
import type {
  VerifiedAuthenticationContext,
} from "./verified-authentication-context.js";

const PLATFORM_AGENCY_ONBOARDING_GRANTS: readonly AuthorityGrant[] =
  Object.freeze([
    "RETRIEVE_AGENCY_REGISTRATIONS",
    "REVIEW_AGENCY_REGISTRATIONS",
    "DECIDE_AGENCY_REGISTRATIONS",
  ]);

export interface PlatformSubjectAuthorityConfiguration {
  readonly issuer: string;
  readonly subjects: readonly string[];
}

export class PlatformExternalAuthorityResolver
  implements ExternalIdentityAuthorityResolver
{
  public constructor(
    private readonly platform: PlatformSubjectAuthorityConfiguration,
    private readonly fallback: ExternalIdentityAuthorityResolver,
  ) {}

  public async resolve(
    context: VerifiedAuthenticationContext,
  ): Promise<AuthenticatedAuthority | undefined> {
    if (
      context.issuer === this.platform.issuer &&
      this.platform.subjects.includes(context.subject)
    ) {
      return {
        actorId: `platform:${context.subject}`,
        authorityId: `platform:${context.subject}`,
        grants: PLATFORM_AGENCY_ONBOARDING_GRANTS,
        tenantIds: Object.freeze([]),
      };
    }

    return this.fallback.resolve(context);
  }
}

export function platformSubjectAuthorityConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): PlatformSubjectAuthorityConfiguration {
  const issuer = environment.AUTHENTICATION_ISSUER?.trim();

  if (issuer === undefined || issuer.length === 0) {
    throw new Error(
      "AUTHENTICATION_ISSUER is required for platform authority resolution",
    );
  }

  const subjects = Object.freeze(
    (environment.PLATFORM_AUTHORITY_SUBJECTS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

  return Object.freeze({
    issuer,
    subjects,
  });
}
