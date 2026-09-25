export interface ExternalIdentityLinkConfiguration {
  readonly issuer: string;
  readonly subject: string;
  readonly internalIdentityId: string;
  readonly tenantId: string;
}

export function externalIdentityLinkConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv,
): ExternalIdentityLinkConfiguration {
  return {
    issuer: required(environment, "EXTERNAL_IDENTITY_ISSUER"),
    subject: required(environment, "EXTERNAL_IDENTITY_SUBJECT"),
    internalIdentityId: required(environment, "EXTERNAL_IDENTITY_INTERNAL_ID"),
    tenantId: required(environment, "EXTERNAL_IDENTITY_TENANT_ID"),
  };
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
