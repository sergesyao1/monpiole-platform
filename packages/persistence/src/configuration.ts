import type { PoolConfig } from "pg";

export interface PostgresConnectionConfiguration {
  readonly connectionString: string;
  readonly maximumPoolSize: number;
  readonly connectionTimeoutMilliseconds: number;
  readonly idleTimeoutMilliseconds: number;
  readonly tls: boolean;
}

export function postgresConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): PostgresConnectionConfiguration {
  const connectionString = environment["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const tlsDisabled = environment["DATABASE_TLS"] === "disabled";
  const isolatedTest = environment["NODE_ENV"] === "test";
  const loopbackDevelopment = environment["MONPIOLE_ENV"] === "development"
    && isLoopbackDatabase(connectionString);
  if (tlsDisabled && !isolatedTest && !loopbackDevelopment) {
    throw new Error("DATABASE_TLS may be disabled only for isolated tests or loopback development");
  }
  if (!tlsDisabled && environment["DATABASE_TLS"] !== "required") {
    throw new Error("DATABASE_TLS must be required or explicitly disabled for loopback development");
  }

  return {
    connectionString,
    maximumPoolSize: positiveInteger(environment["DATABASE_POOL_MAX"], 10, "DATABASE_POOL_MAX"),
    connectionTimeoutMilliseconds: positiveInteger(
      environment["DATABASE_CONNECTION_TIMEOUT_MS"], 5_000, "DATABASE_CONNECTION_TIMEOUT_MS",
    ),
    idleTimeoutMilliseconds: positiveInteger(
      environment["DATABASE_IDLE_TIMEOUT_MS"], 30_000, "DATABASE_IDLE_TIMEOUT_MS",
    ),
    tls: !tlsDisabled,
  };
}

function isLoopbackDatabase(connectionString: string): boolean {
  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function toPoolConfiguration(
  configuration: PostgresConnectionConfiguration,
): PoolConfig {
  return {
    connectionString: configuration.connectionString,
    max: configuration.maximumPoolSize,
    connectionTimeoutMillis: configuration.connectionTimeoutMilliseconds,
    idleTimeoutMillis: configuration.idleTimeoutMilliseconds,
    ssl: configuration.tls ? { rejectUnauthorized: true } : false,
  };
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
