import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgencyDocumentStorageKeyConflictError,
  AgencyOnboardingForbiddenError,
  AgencyRegistrationDocumentContentNotFoundError,
  AgencyRegistrationDocumentIntegrityError,
  AgencyRegistrationDocumentUploadConsumedError,
  AgencyRegistrationDocumentUploadDuplicateError,
  AgencyRegistrationDocumentUploadExpiredError,
  AgencyRegistrationDocumentUploadNotFoundError,
  AgencyRegistrationNotFoundError,
  AgencyRegistrationNumberConflictError,
  AgencyRegistrationDocumentUploadValidationError,
  InvalidAgencyRegistrationTransitionError,
  FirstAdministratorReissueAdministratorNotFoundError,
  FirstAdministratorReissueNotEligibleError,
  FirstAdministratorReissueRegistrationNotFoundError,
  FirstAdministratorReissueRegistrationNotReadyError,
  UploadAgencyRegistrationDocument,
  type AgencyDocumentStorage,
  type AgencyRegistration,
  type AgencyRegistrationDocumentUploadStore,
  type CreateFirstAgencyAdministratorCommand,
  type ReissueFirstAdministratorBootstrapCommand,
} from "../../services/agency-onboarding/src/index.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  AgencyRegistrationListSchema,
  AgencyRegistrationDocumentListSchema,
  AgencyRegistrationDetailsSchema,
  AgencyRegistrationSchema,
  SubmitAgencyRegistrationResponseSchema,
  UploadAgencyRegistrationDocumentResponseSchema,
} from "../../apps/api/src/contracts/v1/agency-onboarding/agency-registration.schema.js";
import {
  CreateFirstAgencyAdministratorResponseSchema,
  ReissueFirstAdministratorBootstrapResponseSchema,
} from "../../apps/api/src/contracts/v1/agency-onboarding/first-administrator.schema.js";

const REGISTRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW = "2026-09-16T12:00:00.000Z";

const UPLOAD_ID =
  "ffffffff-ffff-4fff-8fff-ffffffffffff";

const UPLOAD_EXPIRES_AT =
  "2026-09-17T12:00:00.000Z";

const VALID_PDF = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d,
  0x31, 0x2e, 0x37, 0x0a,
]);

const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0,
  0x00, 0x10, 0x4a, 0x46,
]);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00,
]);

const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

const DOCUMENT_CONTENT = Buffer.from(
  "synthetic-rccm-pdf",
  "utf8",
);

const DOCUMENT_CHECKSUM =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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
  uploadId: UPLOAD_ID,
};

const retrievedDocument = {
  documentId: DOCUMENT_ID,
  registrationId: REGISTRATION_ID,
  documentType: "REGISTRATION_CERTIFICATE",
  storageKey: "agency-registration/test/rccm.pdf",
  originalFilename: "rccm.pdf",
  mimeType: "application/pdf",
  sizeBytes: DOCUMENT_CONTENT.byteLength,
  checksumSha256: DOCUMENT_CHECKSUM,
  createdAt: NOW,
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

function realUploadUseCase(): UploadAgencyRegistrationDocument {
  const storage: AgencyDocumentStorage = {
    store: vi.fn(async () => undefined),
    retrieve: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };

  const uploads: AgencyRegistrationDocumentUploadStore = {
    create: vi.fn(async () => undefined),
  };

  let generatedId = 0;

  return new UploadAgencyRegistrationDocument(
    storage,
    uploads,
    {
      generateId: () => {
        generatedId += 1;

        return generatedId === 1
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222";
      },
      now: () => new Date("2026-09-17T12:00:00.000Z"),
    },
  );
}

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
                "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
              ],
              tenantIds: [],
            };
          },
        },

        uploadAgencyRegistrationDocument: {
          execute: vi.fn(async (input) => ({
            uploadId: UPLOAD_ID,
            originalFilename: input.originalFilename,
            mimeType: input.mimeType,
            sizeBytes: input.content.byteLength,
            checksumSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            expiresAt: UPLOAD_EXPIRES_AT,
          })),
        },

        submitAgencyRegistration: {
          execute: vi.fn(async () => ({
            registration: current,
          })),
        },

        listAgencyRegistrations: {
          execute: vi.fn(async () => [current]),
        },

        retrieveAgencyRegistration: {
          execute: vi.fn(async () => ({
            registration: current,
            documents: [retrievedDocument],
          })),
        },

        retrieveAgencyRegistrationDocumentContent: {
          execute: vi.fn(async () => ({
            document: {
              ...retrievedDocument,
            },
            content: DOCUMENT_CONTENT,
          })),
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

        createFirstAgencyAdministrator: {
          execute: vi.fn(async () => ({
            registrationId: REGISTRATION_ID,
            tenantId: TENANT_ID,
            administratorId:
              "99999999-9999-4999-8999-999999999999",
            role: "TENANT_ADMINISTRATOR" as const,
            status: "PENDING_IDENTITY" as const,
            bootstrapToken: "first-admin-bootstrap-token",
            bootstrapTokenExpiresAt:
              "2026-09-18T13:00:00.000Z",
          })),
        },
        reissueFirstAdministratorBootstrap: {
          execute: vi.fn(async () => ({
            registrationId: REGISTRATION_ID,
            tenantId: TENANT_ID,
            administratorId:
              "99999999-9999-4999-8999-999999999999",
            status: "PENDING_IDENTITY" as const,
            bootstrapToken: "reissued-first-admin-token",
            bootstrapTokenExpiresAt:
              "2026-09-19T13:00:00.000Z",
          })),
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

  it("accepts a public agency registration document upload", async () => {
    await start("none");

    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [VALID_PDF],
        { type: "application/pdf" },
      ),
      "rccm.pdf",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(201);

    expect(
      UploadAgencyRegistrationDocumentResponseSchema.parse(
        await response.json(),
      ),
    ).toEqual({
      uploadId: UPLOAD_ID,
      originalFilename: "rccm.pdf",
      mimeType: "application/pdf",
      sizeBytes: VALID_PDF.byteLength,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: UPLOAD_EXPIRES_AT,
    });
  });

  it.each([
    {
      label: "PDF",
      filename: "rccm.pdf",
      mimeType: "application/pdf",
      content: VALID_PDF,
    },
    {
      label: "JPEG",
      filename: "piece.jpg",
      mimeType: "image/jpeg",
      content: VALID_JPEG,
    },
    {
      label: "PNG",
      filename: "piece.png",
      mimeType: "image/png",
      content: VALID_PNG,
    },
    {
      label: "WebP",
      filename: "piece.webp",
      mimeType: "image/webp",
      content: VALID_WEBP,
    },
  ])(
    "accepts a real public $label upload through HTTP",
    async ({ filename, mimeType, content }) => {
      await start(
        "none",
        {
          uploadAgencyRegistrationDocument:
            realUploadUseCase(),
        },
      );

      const form = new FormData();

      form.append(
        "file",
        new Blob(
          [content],
          { type: mimeType },
        ),
        filename,
      );

      const response = await fetch(
        `${baseUrl}/v1/agency-registration-documents`,
        {
          method: "POST",
          body: form,
        },
      );

      expect(response.status).toBe(201);

      const body =
        UploadAgencyRegistrationDocumentResponseSchema.parse(
          await response.json(),
        );

      expect(body).toMatchObject({
        uploadId:
          "11111111-1111-4111-8111-111111111111",
        originalFilename: filename,
        mimeType,
        sizeBytes: content.byteLength,
        expiresAt: "2026-09-18T12:00:00.000Z",
      });

      expect(body).not.toHaveProperty("storageKey");
    },
  );

  it("rejects an unsupported MIME type through the real upload use case", async () => {
    await start(
      "none",
      {
        uploadAgencyRegistrationDocument:
          realUploadUseCase(),
      },
    );

    const form = new FormData();

    form.append(
      "file",
      new Blob(
        [Buffer.from("plain text", "utf8")],
        { type: "text/plain" },
      ),
      "document.txt",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ),
    ).toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects a MIME and magic-byte mismatch through HTTP", async () => {
    await start(
      "none",
      {
        uploadAgencyRegistrationDocument:
          realUploadUseCase(),
      },
    );

    const form = new FormData();

    form.append(
      "file",
      new Blob(
        [Buffer.from("not-a-pdf", "utf8")],
        { type: "application/pdf" },
      ),
      "fake.pdf",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ),
    ).toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects a document larger than the 50 MiB upload limit", async () => {
    await start("none");

    const oversizedContent =
      Buffer.alloc(
        (50 * 1024 * 1024) + 1,
        0x41,
      );

    const form = new FormData();

    form.append(
      "file",
      new Blob(
        [oversizedContent],
        { type: "application/pdf" },
      ),
      "oversized.pdf",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("content-type"))
      .toContain("application/problem+json");

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ),
    ).toMatchObject({
      status: 413,
      code: "INVALID_REQUEST",
    });
  });

  it("rejects a public document upload without a file", async () => {
    await start("none");

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: new FormData(),
      },
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ),
    ).toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("maps agency document upload validation failures to 400", async () => {
    await start(
      "none",
      {
        uploadAgencyRegistrationDocument: {
          execute: vi.fn(async () => {
            throw new AgencyRegistrationDocumentUploadValidationError(
              "Agency registration document content does not match its MIME type",
            );
          }),
        },
      },
    );

    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [VALID_PDF],
        { type: "application/pdf" },
      ),
      "invalid.pdf",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registration-documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ),
    ).toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("does not expose the temporary agency registrations documents route", async () => {
    await start("none");

    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [VALID_PDF],
        { type: "application/pdf" },
      ),
      "rccm.pdf",
    );

    const response = await fetch(
      `${baseUrl}/v1/agency-registrations/documents`,
      {
        method: "POST",
        body: form,
      },
    );

    expect(response.status).toBe(404);
  });

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
      `${baseUrl}/v1/platform/agency-registrations`,
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
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}`,
    );

    expect(response.status).toBe(200);

    const details = AgencyRegistrationDetailsSchema.parse(
      await response.json(),
    );

    expect(details.registrationId).toBe(REGISTRATION_ID);
    expect(details.documents).toEqual([
      expect.objectContaining({
        documentId: DOCUMENT_ID,
        sizeBytes: DOCUMENT_CONTENT.byteLength,
      }),
    ]);
    expect(typeof details.documents[0]?.sizeBytes).toBe("number");
  });

  it("retrieves a safe first administrator summary without bootstrap credentials", async () => {
    const current = registration({
      status: "APPROVED",
      provisionedTenantId: TENANT_ID,
    });
    await start("platform", {
      retrieveAgencyRegistration: {
        execute: vi.fn(async () => ({
          registration: current,
          documents: [],
          firstAdministrator: {
            administratorId: "99999999-9999-4999-8999-999999999999",
            status: "PENDING_IDENTITY" as const,
            bootstrapTokenExpiresAt: "2026-09-20T09:30:00.000Z",
          },
        })),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}`,
    );
    expect(response.status).toBe(200);
    const details = AgencyRegistrationDetailsSchema.parse(await response.json());
    expect(details.firstAdministrator).toMatchObject({
      administratorId: "99999999-9999-4999-8999-999999999999",
      status: "PENDING_IDENTITY",
    });
    expect(details.firstAdministrator).not.toHaveProperty("bootstrapToken");
    expect(details.firstAdministrator).not.toHaveProperty("bootstrapTokenHash");
  });

  it("lists registration documents with numeric sizes", async () => {
    await start("platform");

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents`,
    );

    expect(response.status).toBe(200);

    const body = AgencyRegistrationDocumentListSchema.parse(
      await response.json(),
    );

    expect(body.items).toEqual([
      expect.objectContaining({
        documentId: DOCUMENT_ID,
        sizeBytes: DOCUMENT_CONTENT.byteLength,
      }),
    ]);
  });

  it("downloads an agency registration document with private binary headers", async () => {
    await start("platform");

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents/${DOCUMENT_ID}/content`,
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type"))
      .toContain("application/pdf");

    expect(response.headers.get("content-length"))
      .toBe(DOCUMENT_CONTENT.byteLength.toString());

    expect(response.headers.get("content-disposition"))
      .toBe('attachment; filename="rccm.pdf"');

    expect(response.headers.get("etag"))
      .toBe(`"${DOCUMENT_CHECKSUM}"`);

    expect(response.headers.get("cache-control"))
      .toBe("private, no-store");

    expect(response.headers.get("x-content-type-options"))
      .toBe("nosniff");

    expect(
      Buffer.from(await response.arrayBuffer()),
    ).toEqual(DOCUMENT_CONTENT);
  });

  it("returns 401 when downloading a document without authentication", async () => {
    await start("none");

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents/${DOCUMENT_ID}/content`,
    );

    expect(response.status).toBe(401);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ).code,
    ).toBe("UNAUTHORIZED");
  });

  it("returns 403 when tenant authority attempts to download an agency document", async () => {
    await start("tenant", {
      retrieveAgencyRegistrationDocumentContent: {
        execute: vi.fn(async () => {
          throw new AgencyOnboardingForbiddenError();
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents/${DOCUMENT_ID}/content`,
    );

    expect(response.status).toBe(403);

    expect(
      ProblemDetailsSchema.parse(
        await response.json(),
      ).code,
    ).toBe("FORBIDDEN");
  });

  it("returns 404 when agency document content is absent", async () => {
    await start("platform", {
      retrieveAgencyRegistrationDocumentContent: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentContentNotFoundError(
            REGISTRATION_ID,
            DOCUMENT_ID,
          );
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents/${DOCUMENT_ID}/content`,
    );

    expect(response.status).toBe(404);

    const body = ProblemDetailsSchema.parse(
      await response.json(),
    );

    expect(body.code).toBe(
      "AGENCY_REGISTRATION_DOCUMENT_NOT_FOUND",
    );
    expect(JSON.stringify(body))
      .not.toContain("agency-registration/test/rccm.pdf");
  });

  it("returns 500 when agency document integrity verification fails", async () => {
    await start("platform", {
      retrieveAgencyRegistrationDocumentContent: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentIntegrityError(
            REGISTRATION_ID,
            DOCUMENT_ID,
          );
        }),
      },
    });

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/documents/${DOCUMENT_ID}/content`,
    );

    expect(response.status).toBe(500);

    const body = ProblemDetailsSchema.parse(
      await response.json(),
    );

    expect(JSON.stringify(body))
      .not.toContain("agency-registration/test/rccm.pdf");
  });
  it("starts review for platform authority", async () => {
    await start("platform");

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/review`,
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
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/reject`,
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
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/approve`,
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
      `${baseUrl}/v1/platform/agency-registrations`,
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
      `${baseUrl}/v1/platform/agency-registrations`,
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
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}`,
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
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/review`,
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

  it("maps duplicate staged upload reference to 400", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentUploadDuplicateError();
        }),
      },
    });

    const response = await post(
      "/v1/agency-registrations",
      submitBody,
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(await response.json()),
    ).toMatchObject({
      status: 400,
      type: "https://api.monpiole.example/problems/invalid-request",
      title: "Invalid request",
      code: "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_DUPLICATE",
    });
  });

  it("maps unknown staged upload reference to 400", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentUploadNotFoundError();
        }),
      },
    });

    const response = await post(
      "/v1/agency-registrations",
      submitBody,
    );

    expect(response.status).toBe(400);

    expect(
      ProblemDetailsSchema.parse(await response.json()),
    ).toMatchObject({
      status: 400,
      type: "https://api.monpiole.example/problems/invalid-request",
      title: "Invalid request",
      code: "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_NOT_FOUND",
    });
  });

  it("maps consumed staged upload reference to 409", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentUploadConsumedError();
        }),
      },
    });

    const response = await post(
      "/v1/agency-registrations",
      submitBody,
    );

    expect(response.status).toBe(409);

    expect(
      ProblemDetailsSchema.parse(await response.json()),
    ).toMatchObject({
      status: 409,
      type: "https://api.monpiole.example/problems/agency-registration-document-upload-conflict",
      title: "Agency registration document upload conflict",
      code: "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_CONSUMED",
    });
  });

  it("maps expired staged upload reference to 409", async () => {
    await start("none", {
      submitAgencyRegistration: {
        execute: vi.fn(async () => {
          throw new AgencyRegistrationDocumentUploadExpiredError();
        }),
      },
    });

    const response = await post(
      "/v1/agency-registrations",
      submitBody,
    );

    expect(response.status).toBe(409);

    expect(
      ProblemDetailsSchema.parse(await response.json()),
    ).toMatchObject({
      status: 409,
      type: "https://api.monpiole.example/problems/agency-registration-document-upload-conflict",
      title: "Agency registration document upload conflict",
      code: "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_EXPIRED",
    });
  });

  it("creates the first agency administrator and returns the bootstrap token once", async () => {
    await start("platform");

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
      },
    );

    expect(response.status).toBe(201);

    const body =
      CreateFirstAgencyAdministratorResponseSchema.parse(
        await response.json(),
      );

    expect(body).toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId:
        "99999999-9999-4999-8999-999999999999",
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrapToken: "first-admin-bootstrap-token",
      bootstrapTokenExpiresAt:
        "2026-09-18T13:00:00.000Z",
    });
  });

  it("derives first administrator authority and correlation server-side", async () => {
    const execute = vi.fn(async (_command: CreateFirstAgencyAdministratorCommand) => ({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId:
        "99999999-9999-4999-8999-999999999999",
      role: "TENANT_ADMINISTRATOR" as const,
      status: "PENDING_IDENTITY" as const,
      bootstrapToken: "first-admin-bootstrap-token",
      bootstrapTokenExpiresAt:
        "2026-09-18T13:00:00.000Z",
    }));

    await start("platform", {
      createFirstAgencyAdministrator: { execute },
    });

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
      },
    );

    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(1);

    const command = execute.mock.calls[0]?.[0];

    expect(command).toMatchObject({
      registrationId: REGISTRATION_ID,
      firstName: "Awa",
      lastName: "Kone",
      email: "awa.kone@example.ci",
      authority: {
        actorId: "platform:reviewer",
        authorityId: "platform:reviewer",
        grants: expect.arrayContaining([
          "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
        ]),
      },
    });

    // Neither identifier is accepted from the browser.
    expect(command).not.toHaveProperty("tenantId");

    // Deterministic server-generated UUID v5.
    expect(command?.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("does not expose the bootstrap token on first administrator replay", async () => {
    await start("platform", {
      createFirstAgencyAdministrator: {
        execute: vi.fn(async () => ({
          registrationId: REGISTRATION_ID,
          tenantId: TENANT_ID,
          administratorId:
            "99999999-9999-4999-8999-999999999999",
          role: "TENANT_ADMINISTRATOR" as const,
          status: "PENDING_IDENTITY" as const,
          bootstrapTokenExpiresAt:
            "2026-09-18T13:00:00.000Z",
        })),
      },
    });

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
      },
    );

    expect(response.status).toBe(201);

    const body =
      CreateFirstAgencyAdministratorResponseSchema.parse(
        await response.json(),
      );

    expect(body.bootstrapToken).toBeUndefined();
    expect(body.status).toBe("PENDING_IDENTITY");
  });

  it("rejects client-controlled tenant and correlation identifiers", async () => {
    const execute = vi.fn();

    await start("platform", {
      createFirstAgencyAdministrator: { execute },
    });

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
        tenantId: TENANT_ID,
        correlationId:
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    );

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();

    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("INVALID_REQUEST");
  });

  it("returns 401 when first administrator creation is unauthenticated", async () => {
    await start("none");

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
      },
    );

    expect(response.status).toBe(401);

    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("UNAUTHORIZED");
  });

  it("returns 403 when tenant authority attempts first administrator creation", async () => {
    await start("tenant", {
      createFirstAgencyAdministrator: {
        execute: vi.fn(async () => {
          throw new AgencyOnboardingForbiddenError();
        }),
      },
    });

    const response = await post(
      `/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator`,
      {
        firstName: "Awa",
        lastName: "Kone",
        email: "awa.kone@example.ci",
      },
    );

    expect(response.status).toBe(403);

    expect(
      ProblemDetailsSchema.parse(await response.json()).code,
    ).toBe("FORBIDDEN");
  });

  it("reissues the first administrator invitation without a request body", async () => {
    await start("platform");

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator/reinvitation`,
      { method: "POST" },
    );

    expect(response.status).toBe(201);
    const body = ReissueFirstAdministratorBootstrapResponseSchema.parse(
      await response.json(),
    );
    expect(body).toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId:
        "99999999-9999-4999-8999-999999999999",
      status: "PENDING_IDENTITY",
      bootstrapToken: "reissued-first-admin-token",
      bootstrapTokenExpiresAt: "2026-09-19T13:00:00.000Z",
    });
    expect(body).not.toHaveProperty("bootstrapTokenHash");
  });

  it("derives reinvitation identity and authority exclusively server-side", async () => {
    const execute = vi.fn(async (_command: ReissueFirstAdministratorBootstrapCommand) => ({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId:
        "99999999-9999-4999-8999-999999999999",
      status: "PENDING_IDENTITY" as const,
      bootstrapToken: "reissued-first-admin-token",
      bootstrapTokenExpiresAt: "2026-09-19T13:00:00.000Z",
    }));
    await start("platform", {
      reissueFirstAdministratorBootstrap: { execute },
    });

    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator/reinvitation?actorId=attacker&tenantId=attacker`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actorId: "attacker",
          authorityId: "attacker",
          tenantId: "attacker",
          internalIdentityId: "attacker",
          bootstrapToken: "attacker",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      registrationId: REGISTRATION_ID,
      authority: {
        actorId: "platform:reviewer",
        authorityId: "platform:reviewer",
        grants: expect.arrayContaining([
          "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
        ]),
      },
    });
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("internalIdentityId");
  });

  it("returns 401 for unauthenticated reinvitation", async () => {
    await start("none");
    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator/reinvitation`,
      { method: "POST" },
    );
    expect(response.status).toBe(401);
    expect(ProblemDetailsSchema.parse(await response.json()).code)
      .toBe("UNAUTHORIZED");
  });

  it("returns 403 when a tenant authority attempts reinvitation", async () => {
    await start("tenant", {
      reissueFirstAdministratorBootstrap: {
        execute: vi.fn(async () => {
          throw new AgencyOnboardingForbiddenError();
        }),
      },
    });
    const response = await fetch(
      `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator/reinvitation`,
      { method: "POST" },
    );
    expect(response.status).toBe(403);
    expect(ProblemDetailsSchema.parse(await response.json()).code)
      .toBe("FORBIDDEN");
  });

  it.each([
    [FirstAdministratorReissueRegistrationNotFoundError, 404,
      "FIRST_ADMINISTRATOR_REISSUE_REGISTRATION_NOT_FOUND"],
    [FirstAdministratorReissueAdministratorNotFoundError, 404,
      "FIRST_ADMINISTRATOR_REISSUE_ADMINISTRATOR_NOT_FOUND"],
    [FirstAdministratorReissueRegistrationNotReadyError, 409,
      "FIRST_ADMINISTRATOR_REISSUE_REGISTRATION_NOT_READY"],
    [FirstAdministratorReissueNotEligibleError, 409,
      "FIRST_ADMINISTRATOR_REISSUE_NOT_ELIGIBLE"],
  ] as const)(
    "maps reinvitation error %s to %s",
    async (ErrorType, status, code) => {
      await start("platform", {
        reissueFirstAdministratorBootstrap: {
          execute: vi.fn(async () => { throw new ErrorType(); }),
        },
      });
      const response = await fetch(
        `${baseUrl}/v1/platform/agency-registrations/${REGISTRATION_ID}/first-administrator/reinvitation`,
        { method: "POST" },
      );
      expect(response.status).toBe(status);
      const problem = ProblemDetailsSchema.parse(await response.json());
      expect(problem.code).toBe(code);
      expect(problem).not.toHaveProperty("bootstrapToken");
      expect(problem).not.toHaveProperty("bootstrapTokenHash");
    },
  );
});
