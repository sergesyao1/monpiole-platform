export interface PublicWebConfig {
  readonly apiBaseUrl: string;
  readonly oidc: Readonly<{
    issuer?: string;
    clientId?: string;
    audience?: string;
  }>;
}

interface PublicEnvironment {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_ISSUER?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_AUDIENCE?: string;
}

export function readPublicWebConfig(environment: PublicEnvironment): PublicWebConfig {
  return {
    apiBaseUrl: normalizedUrl(environment.VITE_API_BASE_URL ?? "http://localhost:3000", "VITE_API_BASE_URL"),
    oidc: {
      issuer: optionalUrl(environment.VITE_OIDC_ISSUER, "VITE_OIDC_ISSUER"),
      clientId: optionalValue(environment.VITE_OIDC_CLIENT_ID),
      audience: optionalValue(environment.VITE_OIDC_AUDIENCE),
    },
  };
}

export const publicWebConfig = readPublicWebConfig({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_OIDC_ISSUER: import.meta.env.VITE_OIDC_ISSUER,
  VITE_OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID,
  VITE_OIDC_AUDIENCE: import.meta.env.VITE_OIDC_AUDIENCE,
});

function normalizedUrl(value: string, name: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`La configuration publique ${name} doit être une URL valide.`);
  }
}

function optionalUrl(value: string | undefined, name: string): string | undefined {
  const normalized = optionalValue(value);
  return normalized === undefined ? undefined : normalizedUrl(normalized, name);
}

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}
