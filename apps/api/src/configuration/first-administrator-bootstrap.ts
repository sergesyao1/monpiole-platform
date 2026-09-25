import type {
  FirstAdministratorBootstrapConfiguration,
} from "@monpiole/agency-onboarding";

export const FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_TTL_SECONDS_ENVIRONMENT_VARIABLE =
  "AGENCY_FIRST_ADMIN_BOOTSTRAP_TOKEN_TTL_SECONDS";

export class InvalidFirstAdministratorBootstrapEnvironmentConfigurationError
  extends Error
{
  readonly code =
    "INVALID_FIRST_ADMINISTRATOR_BOOTSTRAP_ENVIRONMENT_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name =
      "InvalidFirstAdministratorBootstrapEnvironmentConfigurationError";
  }
}

export function firstAdministratorBootstrapConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): FirstAdministratorBootstrapConfiguration {
  const variableName =
    FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_TTL_SECONDS_ENVIRONMENT_VARIABLE;

  const raw = environment[variableName]?.trim();

  if (raw === undefined || raw.length === 0) {
    throw new InvalidFirstAdministratorBootstrapEnvironmentConfigurationError(
      `${variableName} is required`,
    );
  }

  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new InvalidFirstAdministratorBootstrapEnvironmentConfigurationError(
      `${variableName} must be a positive integer`,
    );
  }

  const tokenTtlSeconds = Number(raw);

  if (
    !Number.isSafeInteger(tokenTtlSeconds) ||
    tokenTtlSeconds <= 0
  ) {
    throw new InvalidFirstAdministratorBootstrapEnvironmentConfigurationError(
      `${variableName} must be a positive safe integer`,
    );
  }

  return Object.freeze({
    tokenTtlSeconds,
  });
}