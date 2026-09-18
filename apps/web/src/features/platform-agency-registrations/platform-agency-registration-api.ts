import {
  createAuthenticatedApiClient,
  createAuthenticatedBinaryApiClient,
  type AccessTokenProvider,
} from "../../infrastructure/http/api-client.js";

import type {
  PlatformAgencyRegistration,
  PlatformAgencyRegistrationDetails,
  PlatformAgencyRegistrationList,
  RejectPlatformAgencyRegistrationInput,
} from "./platform-agency-registration-model.js";

export interface PlatformAgencyRegistrationApi {
  readonly listRegistrations: () =>
    Promise<PlatformAgencyRegistrationList>;

  readonly retrieveRegistration: (
    registrationId: string,
  ) => Promise<PlatformAgencyRegistrationDetails>;

  readonly downloadDocument: (
    registrationId: string,
    documentId: string,
  ) => Promise<Blob>;

  readonly startReview: (
    registrationId: string,
  ) => Promise<PlatformAgencyRegistration>;

  readonly rejectRegistration: (
    registrationId: string,
    input: RejectPlatformAgencyRegistrationInput,
  ) => Promise<PlatformAgencyRegistration>;

  readonly approveRegistration: (
    registrationId: string,
  ) => Promise<PlatformAgencyRegistration>;
}

export function createPlatformAgencyRegistrationApi(
  tokens: AccessTokenProvider,
): PlatformAgencyRegistrationApi {
  const requestJson = createAuthenticatedApiClient(tokens);
  const requestBinary = createAuthenticatedBinaryApiClient(tokens);

  return {
    listRegistrations: () =>
      requestJson<PlatformAgencyRegistrationList>(
        "/v1/platform/agency-registrations",
      ),

    retrieveRegistration: (registrationId) =>
      requestJson<PlatformAgencyRegistrationDetails>(
        `/v1/platform/agency-registrations/${registrationId}`,
      ),

    downloadDocument: (registrationId, documentId) =>
      requestBinary(
        `/v1/platform/agency-registrations/${registrationId}/documents/${documentId}/content`,
      ),

    startReview: (registrationId) =>
      requestJson<PlatformAgencyRegistration>(
        `/v1/platform/agency-registrations/${registrationId}/review`,
        {
          method: "POST",
        },
      ),

    rejectRegistration: (registrationId, input) =>
      requestJson<PlatformAgencyRegistration>(
        `/v1/platform/agency-registrations/${registrationId}/reject`,
        {
          method: "POST",
          body: input,
        },
      ),

    approveRegistration: (registrationId) =>
      requestJson<PlatformAgencyRegistration>(
        `/v1/platform/agency-registrations/${registrationId}/approve`,
        {
          method: "POST",
        },
      ),
  };
}