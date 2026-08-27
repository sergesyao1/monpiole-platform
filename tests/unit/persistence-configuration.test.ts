import { describe, expect, it } from "vitest";
import { postgresConfigurationFromEnvironment } from "../../packages/persistence/src/configuration.js";

describe("PostgreSQL connection configuration", () => {
  it("requires an external connection URL without exposing it in errors", () => {
    expect(() => postgresConfigurationFromEnvironment({ NODE_ENV: "production" }))
      .toThrow("DATABASE_URL is required");
  });

  it("requires verified TLS except in isolated tests or loopback development", () => {
    expect(() => postgresConfigurationFromEnvironment({
      DATABASE_URL: "postgresql://sensitive-value", NODE_ENV: "production", DATABASE_TLS: "disabled",
    })).toThrow("DATABASE_TLS may be disabled only for isolated tests or loopback development");
  });

  it("allows TLS-free development only on a loopback database", () => {
    expect(postgresConfigurationFromEnvironment({
      DATABASE_URL: "postgresql://monpiole@127.0.0.1:5432/monpiole",
      DATABASE_TLS: "disabled", MONPIOLE_ENV: "development",
    }).tls).toBe(false);
    expect(() => postgresConfigurationFromEnvironment({
      DATABASE_URL: "postgresql://database.internal/monpiole",
      DATABASE_TLS: "disabled", MONPIOLE_ENV: "development",
    })).toThrow("DATABASE_TLS may be disabled only");
  });

  it("parses bounded pool settings for isolated tests", () => {
    expect(postgresConfigurationFromEnvironment({
      DATABASE_URL: "postgresql://synthetic", DATABASE_POOL_MAX: "4",
      DATABASE_CONNECTION_TIMEOUT_MS: "2500", DATABASE_IDLE_TIMEOUT_MS: "12000",
      DATABASE_TLS: "disabled", NODE_ENV: "test",
    })).toEqual({
      connectionString: "postgresql://synthetic", maximumPoolSize: 4,
      connectionTimeoutMilliseconds: 2500, idleTimeoutMilliseconds: 12000, tls: false,
    });
  });

  it("rejects invalid numeric configuration", () => {
    expect(() => postgresConfigurationFromEnvironment({
      DATABASE_URL: "postgresql://synthetic", DATABASE_POOL_MAX: "0",
      DATABASE_TLS: "disabled", NODE_ENV: "test",
    })).toThrow("DATABASE_POOL_MAX must be a positive integer");
  });
});
