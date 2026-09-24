import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

import type { VerifiedAuthenticationContext } from "./verified-authentication-context.js";

export interface OidcAccessTokenConfiguration {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUri: string;
  readonly algorithms: readonly ["RS256"];
  readonly clockToleranceSeconds: number;
  readonly maximumTokenAgeSeconds: number;
}

export interface VerifiedEmailClaimNames {
  readonly email: string;
  readonly emailVerified: string;
}

export class InvalidAuthenticationConfigurationError extends Error {}

export function oidcAccessTokenConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): OidcAccessTokenConfiguration {
  const issuer = requiredUrl(environment.AUTHENTICATION_ISSUER, "AUTHENTICATION_ISSUER");
  const audience = required(environment.AUTHENTICATION_AUDIENCE, "AUTHENTICATION_AUDIENCE");
  const jwksUri = requiredUrl(environment.AUTHENTICATION_JWKS_URI, "AUTHENTICATION_JWKS_URI");
  const algorithm = environment.AUTHENTICATION_JWT_ALGORITHM ?? "RS256";
  if (algorithm !== "RS256") {
    throw new InvalidAuthenticationConfigurationError("AUTHENTICATION_JWT_ALGORITHM must be RS256");
  }
  return Object.freeze({
    issuer,
    audience,
    jwksUri,
    algorithms: ["RS256"] as const,
    clockToleranceSeconds: boundedInteger(environment.AUTHENTICATION_CLOCK_TOLERANCE_SECONDS, 30, 0, 120),
    maximumTokenAgeSeconds: boundedInteger(environment.AUTHENTICATION_MAX_TOKEN_AGE_SECONDS, 900, 60, 3600),
  });
}

export class OidcAccessTokenVerifier {
  private readonly key: JWTVerifyGetKey;

  constructor(
    private readonly configuration: OidcAccessTokenConfiguration,
    key?: JWTVerifyGetKey,
  ) {
    this.key = key ?? createRemoteJWKSet(new URL(configuration.jwksUri), {
      cacheMaxAge: 600_000,
      cooldownDuration: 30_000,
      timeoutDuration: 5_000,
    });
  }

  async verify(token: string): Promise<VerifiedAuthenticationContext> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: this.configuration.issuer,
      audience: this.configuration.audience,
      algorithms: [...this.configuration.algorithms],
      clockTolerance: this.configuration.clockToleranceSeconds,
      maxTokenAge: `${this.configuration.maximumTokenAgeSeconds} seconds`,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("Missing subject");
    return verifiedAuthenticationContextFromClaims(
      payload,
      verifiedEmailClaimNames(this.configuration.audience),
    );
  }
}

export function verifiedAuthenticationContextFromClaims(
  payload: Record<string, unknown>,
  emailClaims: VerifiedEmailClaimNames,
): VerifiedAuthenticationContext {
  if (typeof payload.iss !== "string" || payload.iss.length === 0) {
    throw new Error("Missing issuer");
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Missing subject");
  }

  const authenticationMethods = Array.isArray(payload.amr)
    ? payload.amr.filter(
        (method): method is string => typeof method === "string",
      )
    : [];
  const email = payload[emailClaims.email];
  const emailVerified = payload[emailClaims.emailVerified];

  return Object.freeze({
    issuer: payload.iss,
    subject: payload.sub,
    ...(typeof email === "string" && email.trim().length > 0
      ? { email: email.trim() }
      : {}),
    ...(typeof emailVerified === "boolean"
      ? { emailVerified }
      : {}),
    ...(typeof payload.auth_time === "number"
      ? {
          authenticatedAt: new Date(
            payload.auth_time * 1000,
          ).toISOString(),
        }
      : {}),
    authenticationMethods: Object.freeze(authenticationMethods),
  });
}

export function verifiedEmailClaimNames(
  audience: string,
): VerifiedEmailClaimNames {
  let namespace: URL;

  try {
    namespace = new URL(audience);
  } catch {
    throw new InvalidAuthenticationConfigurationError(
      "AUTHENTICATION_AUDIENCE must be an absolute URL for verified email claims",
    );
  }

  if (namespace.protocol !== "https:") {
    throw new InvalidAuthenticationConfigurationError(
      "AUTHENTICATION_AUDIENCE must be an HTTPS URL for verified email claims",
    );
  }

  const base = namespace.toString().replace(/\/$/u, "");

  return Object.freeze({
    email: `${base}/claims/email`,
    emailVerified: `${base}/claims/email_verified`,
  });
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new InvalidAuthenticationConfigurationError(`${name} is required`);
  }
  return value.trim();
}

function requiredUrl(value: string | undefined, name: string): string {
  const candidate = required(value, name);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new InvalidAuthenticationConfigurationError(`${name} must be an HTTPS URL`);
  }
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new InvalidAuthenticationConfigurationError(`Authentication duration must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}
