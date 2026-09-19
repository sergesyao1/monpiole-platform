import { createAuthenticatedApiClient, type AccessTokenProvider } from "../../infrastructure/http/api-client.js";

export interface FirstAdministratorActivation {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "ACTIVE";
  readonly identityLinkedAt: string;
  readonly activatedAt: string;
}

export function createAgencyAdministratorActivationApi(tokens: AccessTokenProvider) {
  const requestJson = createAuthenticatedApiClient(tokens);
  return {
    complete: (bootstrapToken: string) =>
      requestJson<FirstAdministratorActivation>(
        "/v1/agency-administrator-bootstrap/completions",
        { method: "POST", body: { bootstrapToken } },
      ),
  };
}
