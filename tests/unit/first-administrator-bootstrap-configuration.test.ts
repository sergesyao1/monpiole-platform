import { describe, expect, it } from "vitest";

import {
  FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_TTL_SECONDS_ENVIRONMENT_VARIABLE,
  InvalidFirstAdministratorBootstrapEnvironmentConfigurationError,
  firstAdministratorBootstrapConfigurationFromEnvironment,
} from "../../apps/api/src/configuration/first-administrator-bootstrap.js";

describe("firstAdministratorBootstrapConfigurationFromEnvironment", () => {
  const variableName =
    FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_TTL_SECONDS_ENVIRONMENT_VARIABLE;

  it("reads a positive integer TTL in seconds", () => {
    const configuration =
      firstAdministratorBootstrapConfigurationFromEnvironment({
        [variableName]: "3600",
      });

    expect(configuration).toEqual({
      tokenTtlSeconds: 3600,
    });

    expect(Object.isFrozen(configuration)).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const configuration =
      firstAdministratorBootstrapConfigurationFromEnvironment({
        [variableName]: " 86400 ",
      });

    expect(configuration.tokenTtlSeconds).toBe(86400);
  });

  it.each([
    undefined,
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "abc",
    "12seconds",
  ])("rejects invalid TTL value %s", (value) => {
    const environment: NodeJS.ProcessEnv = {};

    if (value !== undefined) {
      environment[variableName] = value;
    }

    expect(() =>
      firstAdministratorBootstrapConfigurationFromEnvironment(environment),
    ).toThrow(
      InvalidFirstAdministratorBootstrapEnvironmentConfigurationError,
    );
  });

  it("rejects values larger than the JavaScript safe integer range", () => {
    expect(() =>
      firstAdministratorBootstrapConfigurationFromEnvironment({
        [variableName]: "9007199254740992",
      }),
    ).toThrow(
      InvalidFirstAdministratorBootstrapEnvironmentConfigurationError,
    );
  });
});