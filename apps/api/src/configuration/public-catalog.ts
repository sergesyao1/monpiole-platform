const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface PublicCatalogTenantResolver {
  resolve(hostHeader: string | undefined): string | undefined;
}

export class PublicCatalogNotFoundError extends Error {
  readonly code = "PUBLIC_CATALOG_NOT_FOUND";

  constructor() {
    super("Public catalog not found");
  }
}

export class AllowlistedPublicCatalogTenantResolver implements PublicCatalogTenantResolver {
  constructor(private readonly tenantsByHost: ReadonlyMap<string, string>) {}

  resolve(hostHeader: string | undefined): string | undefined {
    if (hostHeader === undefined) return undefined;
    const canonical = canonicalHost(hostHeader);
    return canonical === undefined ? undefined : this.tenantsByHost.get(canonical);
  }
}

export interface PublicCatalogHostAllowlist {
  readonly resolver: PublicCatalogTenantResolver;
  readonly size: number;
}

export function publicCatalogHostAllowlistFromEnvironment(environment: NodeJS.ProcessEnv): PublicCatalogHostAllowlist {
  const configured = environment["PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST"]?.trim();
  if (configured === undefined || configured.length === 0) {
    return { resolver: new AllowlistedPublicCatalogTenantResolver(new Map()), size: 0 };
  }

  const entries = new Map<string, string>();
  for (const rawEntry of configured.split(",")) {
    const separator = rawEntry.lastIndexOf("=");
    if (separator <= 0 || separator === rawEntry.length - 1) throw invalidAllowlist();
    const rawHost = rawEntry.slice(0, separator).trim();
    const tenantId = rawEntry.slice(separator + 1).trim();
    const host = canonicalHost(rawHost);
    if (host === undefined || !UUID.test(tenantId) || entries.has(host)) throw invalidAllowlist();
    entries.set(host, tenantId.toLowerCase());
  }
  if (environment["MONPIOLE_ENV"] === "production") {
    throw new Error("PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST must remain empty in production until Internet exposure gates are approved");
  }
  return { resolver: new AllowlistedPublicCatalogTenantResolver(entries), size: entries.size };
}

export function requirePublicCatalogTenant(
  resolver: PublicCatalogTenantResolver,
  hostHeader: string | undefined,
): string {
  const tenantId = resolver.resolve(hostHeader);
  if (tenantId === undefined) throw new PublicCatalogNotFoundError();
  return tenantId;
}

function canonicalHost(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 260 || trimmed.includes("*") || /[\s,@/\\?#]/u.test(trimmed)) return undefined;
  try {
    const parsed = new URL(`http://${trimmed}`);
    if (parsed.username.length > 0 || parsed.password.length > 0 || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return undefined;
    }
    const canonical = parsed.host.toLowerCase();
    return canonical === trimmed.toLowerCase() ? canonical : undefined;
  } catch {
    return undefined;
  }
}

function invalidAllowlist(): Error {
  return new Error("PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST must contain unique canonical host=tenantUuid entries");
}
