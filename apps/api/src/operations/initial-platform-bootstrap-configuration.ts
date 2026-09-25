export const INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION = "INITIALIZE_EMPTY_MONPIOLE_PLATFORM";

export interface InitialPlatformBootstrapConfiguration {
  readonly operatorId: string;
  readonly idempotencyKey: string;
  readonly organizationName: string;
  readonly responsiblePersonName: string;
  readonly responsibleEmail: string;
  readonly responsibleTelephone: string;
  readonly country: string;
  readonly administratorEmail: string;
  readonly administratorFirstName: string;
  readonly administratorLastName: string;
}

export function initialPlatformBootstrapConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): InitialPlatformBootstrapConfiguration {
  if (environment["INITIAL_PLATFORM_BOOTSTRAP_ENABLED"] !== "true") {
    throw new Error("INITIAL_PLATFORM_BOOTSTRAP_ENABLED must equal true");
  }
  if (environment["INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION"] !== INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION) {
    throw new Error(`INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION must equal ${INITIAL_PLATFORM_BOOTSTRAP_CONFIRMATION}`);
  }
  return {
    operatorId: required(environment, "INITIAL_PLATFORM_BOOTSTRAP_OPERATOR_ID"),
    idempotencyKey: required(environment, "INITIAL_PLATFORM_BOOTSTRAP_IDEMPOTENCY_KEY"),
    organizationName: required(environment, "INITIAL_PLATFORM_ORGANIZATION_NAME"),
    responsiblePersonName: required(environment, "INITIAL_PLATFORM_RESPONSIBLE_PERSON_NAME"),
    responsibleEmail: required(environment, "INITIAL_PLATFORM_RESPONSIBLE_EMAIL"),
    responsibleTelephone: required(environment, "INITIAL_PLATFORM_RESPONSIBLE_TELEPHONE"),
    country: required(environment, "INITIAL_PLATFORM_COUNTRY"),
    administratorEmail: required(environment, "INITIAL_PLATFORM_ADMINISTRATOR_EMAIL"),
    administratorFirstName: required(environment, "INITIAL_PLATFORM_ADMINISTRATOR_FIRST_NAME"),
    administratorLastName: required(environment, "INITIAL_PLATFORM_ADMINISTRATOR_LAST_NAME"),
  };
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
