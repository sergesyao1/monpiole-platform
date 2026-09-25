import { describe, expect, it, vi } from "vitest";

import {
  SubmitAgencyRegistration,
  type SubmitAgencyRegistrationInput,
  type SubmitAgencyRegistrationStore,
} from "../../../services/agency-onboarding/src/index.js";

describe("SubmitAgencyRegistration", () => {
  it("creates a submitted registration and document metadata atomically", async () => {
    const submitted: SubmitAgencyRegistrationInput[] = [];
    const submit: SubmitAgencyRegistrationStore["submit"] = vi.fn(
      async (input) => {
        submitted.push(input);
      },
    );

    const store: SubmitAgencyRegistrationStore = {
      submit,
    };

    const generated = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];

    const useCase = new SubmitAgencyRegistration(
      store,
      {
        now: () => "2026-09-16T17:00:00.000Z",
      },
      {
        generate: () => {
          const value = generated.shift();

          if (value === undefined) {
            throw new Error("Unexpected ID generation");
          }

          return value;
        },
      },
    );

    const result = await useCase.execute({
      agencyLegalName: "Agence Exemple CI SARL",
      agencyTradeName: "Agence Exemple",
      registrationNumber: "CI-ABJ-2026-B-12345",
      taxIdentifier: "CC-1234567",

      phone: "+2250102030405",
      email: "contact@agence.example",
      website: "https://agence.example",

      address: "Cocody",
      city: "Abidjan",
      countryCode: "CI",

      contactFirstName: "Awa",
      contactLastName: "Kone",
      contactEmail: "awa.kone@agence.example",
      contactPhone: "+2250506070809",

      documents: [
        {
          documentType: "REGISTRATION_CERTIFICATE",
          uploadId: "44444444-4444-4444-8444-444444444444",
        },
      ],

      correlationId:
        "33333333-3333-4333-8333-333333333333",
    });

    expect(result.registration).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "SUBMITTED",
      agencyLegalName: "Agence Exemple CI SARL",
      registrationNumber: "CI-ABJ-2026-B-12345",
      submittedAt: "2026-09-16T17:00:00.000Z",
      createdAt: "2026-09-16T17:00:00.000Z",
      updatedAt: "2026-09-16T17:00:00.000Z",
      correlationId:
        "33333333-3333-4333-8333-333333333333",
    });

    expect(submitted).toEqual([{
      registration: result.registration,
      documents: [
        {
        documentId:
          "22222222-2222-4222-8222-222222222222",
          documentType: "REGISTRATION_CERTIFICATE",
          uploadId: "44444444-4444-4444-8444-444444444444",
        },
      ],
    }]);

    expect(submit).toHaveBeenCalledOnce();
  });
});
