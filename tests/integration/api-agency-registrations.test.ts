import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgencyDocumentStorageKeyConflictError,
  AgencyOnboardingForbiddenError,
  AgencyRegistrationNotFoundError,
  AgencyRegistrationNumberConflictError,
  InvalidAgencyRegistrationTransitionError,
  type AgencyRegistration,
} from "../../services/agency-onboarding/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  AgencyRegistrationListSchema,
  AgencyRegistrationSchema,
  SubmitAgencyRegistrationResponseSchema,
} from "../../apps/api/src/contracts/v1/agency-onboarding/agency-registration.schema.js";

const REGISTRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-09-16T12:00:00.000Z";

function registration(
  override: Partial<AgencyRegistration> = {},
): AgencyRegistration {
  return {
    id: REGISTRATION_ID,
    status: "SUBMITTED",
    agencyLegalName: "Agence Ivoire Immobilier",
    agencyTradeName: "A2I",
    registrationNumber: "CI-ABJ-2026-B-12345",
    taxIdentifier: "CC-1234567",
    phone: "+2250102030405",
    email: "contact@a2i.example",
    website: "https://a2i.example",
    address: "Cocody Riviera",
    city: "Abidjan",
    countryCode: "CI",
    contactFirstName: "Awa",
    contactLastName: "Kone",
    contactEmail: "awa@a2i.example",
    contactPhone: "+2250506070809",
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ...override,
  };
}

const document = {
  documentType: "REGISTRATION_CERTIFICATE",
  storageKey: "agency-registration/test/rccm.pdf",
  originalFilename: "rccm.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  checksumSha256:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

const submitBody = {
  agencyLegalName: "Agence Ivoire Immobilier",
  agencyTradeName: "A2I",
  registrationNumber: "CI-ABJ-2026-B-12345",
  taxIdentifier: "CC-1234567",
  phone: "+2250102030405",
  email: "contact@a2i.example",
  website: "https://a2i.example",
  address: "Cocody Riviera",
  city: "Abidjan",
  countryCode: "CI",
  contactFirstName: "Awa",
  contactLastName: "Kone",
  contactEmail: "awa@a2i.example",
  contactPhone: "+2250506070809",
  documents: [document],
};

describe("Agency registrations HTTP", () => {
  let application:
    | Awaited<ReturnType<typeof createApiApplication>>
    | undefined;
  let baseUrl = "";

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  async function start(
    authority:
      | "platform"
      | "tenant"
      | "none" = "platform",
    overrides: Record<string, unknown> = {},
  ) {
    const current = registration();

    application = await createApiApplication(
      { logger: false },
      {
        authenticatedAuthorityProvider: {
          resolve: async () => {
            if (authority === "none") return undefined;

            if (authority === "tenant") {
              return {
                actorId: "tenant-actor",
                authorityId: "tenant-authority",
                grants: ["LIST_PROPERTIES"],
                tenantIds: [
                  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                ],
              };
            }

            return {
              actorId: "platform:reviewer",
              authorityId: "platform:reviewer",
              grants: [
                "RETRIEVE_AGENCY_REGISTRATIONS",
                "REVIEW_AGENCY_REGISTRATIONS",
                "DECIDE_AGENCY_REGISTRATIONS",
              ],
              tenantIds: [],
            };
          },
        },

        submitAgencyRegistration: {
          execute: vi.fn(async () => ({
            registration: current,
            documents: [],
          })),
        },

        listAgencyRegistrations: {
          execute: vi.fn(async () => [current]),
        },

        retrieveAgencyRegistration: {
          execute: vi.fn(async () => current),
        },

        startAgencyRegistrationReview: {
          execute: vi.fn(async () =>
            registration({
              status: "UNDER_REVIEW",
              reviewStartedAt: NOW,
              reviewedByIdentityId: "platform:reviewer",
            }),
          ),
        },

        rejectAgencyRegistration: {
          execute: vi.fn(async () =>
            registration({
              status: "REJECTED",
              reviewStartedAt: NOW,
              reviewedByIdentityId: "platform:reviewer",
              rejectedAt: NOW,
              rejectionReason: "Justificatif invalide",
            }),
          ),
        },

        approveAgencyRegistration: {
          execute: vi.fn(async () =>
            registration({
              status: "APPROVED",
              reviewStartedAt: NOW,
              reviewedByIdentityId: "platform:reviewer",
              approvalProvisioningStartedAt: NOW,
              approvedAt: NOW,
              provisionedTenantId: TENANT_ID,
            }),
          ),
        },

        ...overrides,
      },
    );

    await application.listen(0, "127.0.0.1");

    const address = application.getHttpServer().address();

    if (address === null || typeof address === "string") {
      throw new Error("API did not bind");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  function post(path: string, body?: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    });
  }

  it("accepts public agency registration without authentication", async () => {
    await start("none");

    const response = await post(
      "/v1/agency-registrations",
      submitBody,
    );

    expect(response.status).toBe(201);

    expect(
      SubmitAgencyRegistrationResponseSchema.parse(
        await response.json(),
      ),
    ).toEqual({
      registrationId: REGISTRATION_ID,
      status: "SUBMITTED",
      submittedAt: NOW,
    });
  });

  it("lists registrations for platform authority", async () => {
    await start("platform");

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations`,
    );

    expect(response.status).toBe(200);

    const body = AgencyRegistrationListSchema.parse(
      await response.json(),
    );

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.registrationId).toBe(
      REGISTRATION_ID,
    );
  });

  it("retrieves one registration for platform authority", async () => {
    await start("platform");

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations/${REGISTRATION_ID}`,
    );

    expect(response.status).toBe(200);

    expect(
      AgencyRegistrationSchema.parse(await response.json())
        .registrationId,
    ).toBe(REGISTRATION_ID);
  });

  it("starts review for platform authority", async () => {
    await start("platform");

    const response = await post(
      `/v1/agency-registrations/${REGISTRATION_ID}/review`,
    );

    expect(response.status).toBe(200);

    expect(
      AgencyRegistrationSchema.parse(await response.json())
        .status,
    ).toBe("UNDER_REVIEW");
  });

  it("rejects a registration for platform authority", async () => {
    await start("platform");

    const response = await post(
      `/v1/agency-registrations/${REGISTRATION_ID}/reject`,
      { rejectionReason: "Justificatif invalide" },
    );

    expect(response.status).toBe(200);

    expect(
      AgencyRegistrationSchema.parse(await response.json())
        .status,
    ).toBe("REJECTED");
  });

  it("approves a registration and exposes provisioned tenant", async () => {
    await start("platform");

    const response = await post(
      `/v1/agency-registrations/${REGISTRATION_ID}/approve`,
    );

    expect(response.status).toBe(200);

    const body = AgencyRegistrationSchema.parse(
      await response.json(),
    );

    expect(body.status).toBe("APPROVED");
    expect(body.provisionedTenantId).toBe(TENANT_ID);
  });

  it("returns 401 when no authority exists on platform route", async () => {
    await start("none");

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations`,
    );

    expect(response.status).toBe(401);
    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("UNAUTHORIZED");
  });

  it("does not grant platform access to a tenant authority", async () => {
    await start("tenant", {
      listAgencyRegistrations: {
        execute: vi.fn(async () => {
          throw new AgencyOnboardingForbiddenError();
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations`,
    );

    expect(response.status).toBe(403);
    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("FORBIDDEN");
  });

  it("maps agency registration not found to 404", async () => {
    await start("platform", {
      retrieveAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationNotFoundError();
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations/${REGISTRATION_ID}`,
    );

    expect(response.status).toBe(404);
    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("AGENCY_REGISTRATION_NOT_FOUND");
  });

  it("maps invalid lifecycle transition to 409", async () => {
    await start("platform", {
      startAgencyRegistrationReview: {
        execute: vi.fn(async () => {
          throw new InvalidAgencyRegistrationTransitionError();
        }),
      },
    });

    const response = await post(
      `/v1/agency-registrations/${REGISTRATION_ID}/review`,
    );

    expect(response.status).toBe(409);
    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("INVALID_AGENCY_REGISTRATION_TRANSITION");
  });

  it("maps duplicate agency registration number to 409", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationNumberConflictError();
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(submitBody),
      },
    );

    expect(response.status).toBe(409);

    const problem = ProblemDetailsSchema.parse(
      await response.json(),
    );

    expect(problem).toMatchObject({
      status: 409,
      type: "https://api.monpiole.example/problems/agency-registration-number-conflict",
      title: "Agency registration conflict",
      code: "AGENCY_REGISTRATION_NUMBER_CONFLICT",
    });
  });

  it("maps duplicate agency document storage key to 409", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyDocumentStorageKeyConflictError();
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(submitBody),
      },
    );

    expect(response.status).toBe(409);

    const problem = ProblemDetailsSchema.parse(
      await response.json(),
    );

    expect(problem).toMatchObject({
      status: 409,
      type: "https://api.monpiole.example/problems/agency-document-storage-key-conflict",
      title: "Agency document conflict",
      code: "AGENCY_DOCUMENT_STORAGE_KEY_CONFLICT",
    });
  });
});