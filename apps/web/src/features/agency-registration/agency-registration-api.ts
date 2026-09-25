import { requestJson } from "../../infrastructure/http/api-client.js";

import type {
  AgencyRegistrationDocumentUpload,
  AgencyRegistrationInput,
  AgencyRegistrationSubmission,
} from "./agency-registration-model.js";

export interface AgencyRegistrationApi {
  readonly uploadDocument: (
    file: File,
  ) => Promise<AgencyRegistrationDocumentUpload>;

  readonly submitRegistration: (
    input: AgencyRegistrationInput,
  ) => Promise<AgencyRegistrationSubmission>;
}

export function createAgencyRegistrationApi(): AgencyRegistrationApi {
  return {
    uploadDocument: (file) => {
      const form = new FormData();
      form.append("file", file);

      return requestJson<AgencyRegistrationDocumentUpload>(
        "/v1/agency-registration-documents",
        {
          method: "POST",
          body: form,
        },
      );
    },

    submitRegistration: (input) =>
      requestJson<AgencyRegistrationSubmission>(
        "/v1/agency-registrations",
        {
          method: "POST",
          body: input,
        },
      ),
  };
}