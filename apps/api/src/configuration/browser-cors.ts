import type { INestApplication } from "@nestjs/common";

export interface BrowserCorsConfiguration { readonly allowedOrigins: readonly string[]; }

export class InvalidBrowserCorsConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidBrowserCorsConfigurationError"; }
}

export function browserCorsConfigurationFromEnvironment(environment: NodeJS.ProcessEnv): BrowserCorsConfiguration {
  const raw = environment.API_ALLOWED_BROWSER_ORIGINS;
  if (raw === undefined || raw.trim().length === 0) {
    throw new InvalidBrowserCorsConfigurationError("API_ALLOWED_BROWSER_ORIGINS is required");
  }
  const allowedOrigins = [...new Set(raw.split(",").map((value) => normalizeOrigin(value.trim())))];
  return Object.freeze({ allowedOrigins: Object.freeze(allowedOrigins) });
}

export function configureBrowserCors(application: INestApplication, configuration: BrowserCorsConfiguration): void {
  application.enableCors({
    origin: [...configuration.allowedOrigins],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Correlation-Id", "X-Tenant-Id", "Idempotency-Key"],
    exposedHeaders: ["X-Correlation-Id", "X-Request-Id"],
    credentials: false,
  });
}

function normalizeOrigin(value: string): string {
  if (value === "*") throw new InvalidBrowserCorsConfigurationError("Wildcard browser origins are forbidden");
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== value.replace(/\/$/u, "")) throw new Error();
    return url.origin;
  } catch {
    throw new InvalidBrowserCorsConfigurationError("Browser origins must be absolute HTTP(S) origins");
  }
}
