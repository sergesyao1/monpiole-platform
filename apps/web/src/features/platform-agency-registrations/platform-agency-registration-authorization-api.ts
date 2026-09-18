import {
  ApiForbiddenError,
  createAuthenticatedApiClient,
  type AccessTokenProvider,
} from "../../infrastructure/http/api-client.js";

export interface PlatformAgencyRegistrationAuthorizationApi {
  readonly canRetrieveRegistrations: () => Promise<boolean>;
}

export function createPlatformAgencyRegistrationAuthorizationApi(
  tokens: AccessTokenProvider,
): PlatformAgencyRegistrationAuthorizationApi {
  const request = createAuthenticatedApiClient(tokens);

  return {
    async canRetrieveRegistrations(): Promise<boolean> {
      try {
        await request<void>(
          "/v1/authentication/authorization/platform-agency-registration-read",
        );
        return true;
      } catch (error) {
        if (error instanceof ApiForbiddenError) {
          return false;
        }

        throw error;
      }
    },
  };
}