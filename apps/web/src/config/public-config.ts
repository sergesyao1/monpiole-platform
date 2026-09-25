export interface PublicWebConfig {
  readonly apiBaseUrl: string;
  readonly oidc: Readonly<{
    issuer: string;
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
    logoutReturnUri: string;
  }>;
}

interface PublicEnvironment {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_ISSUER?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_AUDIENCE?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_LOGOUT_RETURN_URI?: string;
}

export function readPublicWebConfig(environment: PublicEnvironment): PublicWebConfig {
  const issuer = requiredHttpsUrl(environment.VITE_OIDC_ISSUER, "VITE_OIDC_ISSUER");
  return {
    apiBaseUrl: normalizedUrl(environment.VITE_API_BASE_URL ?? "http://localhost:3000", "VITE_API_BASE_URL"),
    oidc: {
      issuer,
      domain: new URL(issuer).host,
      clientId: requiredValue(environment.VITE_OIDC_CLIENT_ID, "VITE_OIDC_CLIENT_ID"),
      audience: requiredValue(environment.VITE_OIDC_AUDIENCE, "VITE_OIDC_AUDIENCE"),
      redirectUri: normalizedUrl(requiredValue(environment.VITE_OIDC_REDIRECT_URI, "VITE_OIDC_REDIRECT_URI"), "VITE_OIDC_REDIRECT_URI"),
      logoutReturnUri: normalizedUrl(requiredValue(environment.VITE_OIDC_LOGOUT_RETURN_URI, "VITE_OIDC_LOGOUT_RETURN_URI"), "VITE_OIDC_LOGOUT_RETURN_URI"),
    },
  };
}

export const publicWebConfig = readPublicWebConfig({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_OIDC_ISSUER: import.meta.env.VITE_OIDC_ISSUER,
  VITE_OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID,
  VITE_OIDC_AUDIENCE: import.meta.env.VITE_OIDC_AUDIENCE,
  VITE_OIDC_REDIRECT_URI: import.meta.env.VITE_OIDC_REDIRECT_URI,
  VITE_OIDC_LOGOUT_RETURN_URI: import.meta.env.VITE_OIDC_LOGOUT_RETURN_URI,
});

function normalizedUrl(value: string, name: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`La configuration publique ${name} doit être une URL valide.`);
  }
}

function requiredHttpsUrl(value: string | undefined, name: string): string {
  const normalized = normalizedUrl(requiredValue(value, name), name);
  if (new URL(normalized).protocol !== "https:") {
    throw new Error(`La configuration publique ${name} doit être une URL HTTPS.`);
  }
  return `${normalized}/`;
}

function requiredValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) {
    throw new Error(`La configuration publique ${name} est obligatoire.`);
  }
  return normalized;
}
