import { describe, expect, it } from "vitest";

import {
  INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION,
  initialPlatformBootstrapConfigurationFromEnvironment,
} from "../../apps/api/src/operations/initial-platform-bootstrap-configuration.js";

const valid = {
  INITIAL_PLATFORM_BOOTSTRAP_ENABLED: "true",
  INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION,
  INITIAL_PLATFORM_BOOTSTRAP_OPERATOR_ID: "operator@example.invalid",
  INITIAL_PLATFORM_BOOTSTRAP_IDEMPOTENCY_KEY: "initial-bootstrap-20260826",
  INITIAL_PLATFORM_ORGANIZATION_NAME: "MonPiole Development",
  INITIAL_PLATFORM_RESPONSIBLE_PERSON_NAME: "Ada Operator",
  INITIAL_PLATFORM_RESPONSIBLE_EMAIL: "operator@example.invalid",
  INITIAL_PLATFORM_RESPONSIBLE_TELEPHONE: "+2250102030405",
  INITIAL_PLATFORM_COUNTRY: "CI",
  INITIAL_PLATFORM_ADMINISTRATOR_EMAIL: "admin@example.invalid",
  INITIAL_PLATFORM_ADMINISTRATOR_FIRST_NAME: "Alice",
  INITIAL_PLATFORM_ADMINISTRATOR_LAST_NAME: "Admin",
};

describe("initial platform bootstrap configuration", () => {
  it("requires an explicit enable flag and exact destructive confirmation", () => {
    expect(() => initialPlatformBootstrapConfigurationFromEnvironment({ ...valid, INITIAL_PLATFORM_BOOTSTRAP_ENABLED: "false" }))
      .toThrow("INITIAL_PLATFORM_BOOTSTRAP_ENABLED must equal true");
    expect(() => initialPlatformBootstrapConfigurationFromEnvironment({ ...valid, INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION: "yes" }))
      .toThrow(`INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION must equal ${INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION}`);
  });

  it.each(Object.keys(valid).filter((name) => !name.endsWith("ENABLED") && !name.endsWith("CONFIRMATION")))(
    "requires %s",
    (missing) => {
      const environment = { ...valid } as NodeJS.ProcessEnv;
      delete environment[missing];
      expect(() => initialPlatformBootstrapConfigurationFromEnvironment(environment)).toThrow(`${missing} is required`);
    },
  );
});
