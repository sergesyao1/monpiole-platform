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

  const localTest = environment["NODE_ENV"] === "test" &&
    environment["DATABASE_TLS"] === "disabled";
  if (!localTest && environment["DATABASE_TLS"] !== "required") {
    throw new Error("DATABASE_TLS must be required outside isolated tests");
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
    tls: !localTest,
  };
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
