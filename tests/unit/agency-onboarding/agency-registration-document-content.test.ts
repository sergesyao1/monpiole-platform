import { createHash, randomUUID } from "node:crypto";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  AgencyOnboardingForbiddenError,
  AgencyRegistrationDocumentContentNotFoundError,
  AgencyRegistrationDocumentIntegrityError,
  RetrieveAgencyRegistrationDocumentContent,
  type AgencyDocumentStorage,
  type AgencyOnboardingAuthority,
  type AgencyRegistrationDocument,
  type AgencyRegistrationQueryStore,
} from "../../../services/agency-onboarding/src/index.js";

const AUTHORITY: AgencyOnboardingAuthority =
  Object.freeze({
    actorId: "platform-reviewer",
    authorityId: "platform-reviewer",
    grants: Object.freeze([
      "RETRIEVE_AGENCY_REGISTRATIONS" as const,
    ]),
  });

const FORBIDDEN_AUTHORITY: AgencyOnboardingAuthority =
  Object.freeze({
    actorId: "platform-user-without-grant",
    authorityId: "platform-user-without-grant",
    grants: Object.freeze([]),
  });

function documentFixture(
  overrides: Partial<AgencyRegistrationDocument> = {},
): AgencyRegistrationDocument {
  const content = Buffer.from(
    "synthetic-agency-document",
    "utf8",
  );

  return Object.freeze({
    documentId: randomUUID(),
    registrationId: randomUUID(),
    documentType: "REGISTRATION_CERTIFICATE",
    storageKey:
      `agency-registration-documents/${randomUUID()}`,
    originalFilename: "registre-commerce.pdf",
    mimeType: "application/pdf",
    sizeBytes: content.byteLength,
    checksumSha256: createHash("sha256")
      .update(content)
      .digest("hex"),
    createdAt: "2026-09-16T18:00:00.000Z",
    ...overrides,
  });
}

function queryStore(
  findDocument: AgencyRegistrationQueryStore["findDocument"],
): AgencyRegistrationQueryStore {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    listDocuments: vi.fn(),
    findFirstAdministrator: vi.fn(),
    findDocument,
  };
}

function storage(
  retrieve: AgencyDocumentStorage["retrieve"],
): AgencyDocumentStorage {
  return {
    store: vi.fn(),
    retrieve,
    delete: vi.fn(),
  };
}

describe(
  "RetrieveAgencyRegistrationDocumentContent",
  () => {
    it(
      "returns the exact content when metadata and storage match",
      async () => {
        const content = Buffer.from(
          "synthetic-agency-document",
          "utf8",
        );

        const document = documentFixture({
          sizeBytes: content.byteLength,
          checksumSha256: createHash("sha256")
            .update(content)
            .digest("hex"),
        });

        const findDocument = vi.fn(
          async (
            registrationId: string,
            documentId: string,
          ) => {
            if (
              registrationId ===
                document.registrationId &&
              documentId === document.documentId
            ) {
              return document;
            }

            return undefined;
          },
        );

        const retrieve = vi.fn(
          async (storageKey: string) => {
            if (storageKey !== document.storageKey) {
              return undefined;
            }

            return Object.freeze({
              content,
            });
          },
        );

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(findDocument),
            storage(retrieve),
          );

        const result = await useCase.execute({
          authority: AUTHORITY,
          registrationId: document.registrationId,
          documentId: document.documentId,
        });

        expect(result.document).toBe(document);
        expect(
          Buffer.from(result.content),
        ).toEqual(content);

        expect(findDocument).toHaveBeenCalledWith(
          document.registrationId,
          document.documentId,
        );

        expect(retrieve).toHaveBeenCalledWith(
          document.storageKey,
        );
      },
    );

    it(
      "returns not found when the document does not exist",
      async () => {
        const registrationId = randomUUID();
        const documentId = randomUUID();

        const retrieve = vi.fn();

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(
              vi.fn(async () => undefined),
            ),
            storage(retrieve),
          );

        await expect(
          useCase.execute({
            authority: AUTHORITY,
            registrationId,
            documentId,
          }),
        ).rejects.toBeInstanceOf(
          AgencyRegistrationDocumentContentNotFoundError,
        );

        expect(retrieve).not.toHaveBeenCalled();
      },
    );

    it(
      "does not retrieve a document belonging to another registration",
      async () => {
        const document = documentFixture();

        const requestedRegistrationId =
          randomUUID();

        const findDocument = vi.fn(
          async (
            registrationId: string,
            documentId: string,
          ) => {
            if (
              registrationId ===
                document.registrationId &&
              documentId === document.documentId
            ) {
              return document;
            }

            return undefined;
          },
        );

        const retrieve = vi.fn();

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(findDocument),
            storage(retrieve),
          );

        await expect(
          useCase.execute({
            authority: AUTHORITY,
            registrationId:
              requestedRegistrationId,
            documentId: document.documentId,
          }),
        ).rejects.toBeInstanceOf(
          AgencyRegistrationDocumentContentNotFoundError,
        );

        expect(findDocument).toHaveBeenCalledWith(
          requestedRegistrationId,
          document.documentId,
        );

        expect(retrieve).not.toHaveBeenCalled();
      },
    );

    it(
      "returns not found when metadata exists but physical content is absent",
      async () => {
        const document = documentFixture();

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(
              vi.fn(async () => document),
            ),
            storage(
              vi.fn(async () => undefined),
            ),
          );

        await expect(
          useCase.execute({
            authority: AUTHORITY,
            registrationId:
              document.registrationId,
            documentId: document.documentId,
          }),
        ).rejects.toBeInstanceOf(
          AgencyRegistrationDocumentContentNotFoundError,
        );
      },
    );

    it(
      "rejects content whose byte size differs from persisted metadata",
      async () => {
        const content = Buffer.from(
          "tampered-content",
          "utf8",
        );

        const document = documentFixture({
          sizeBytes:
            content.byteLength + 10,
        });

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(
              vi.fn(async () => document),
            ),
            storage(
              vi.fn(async () =>
                Object.freeze({
                  content,
                }),
              ),
            ),
          );

        await expect(
          useCase.execute({
            authority: AUTHORITY,
            registrationId:
              document.registrationId,
            documentId: document.documentId,
          }),
        ).rejects.toBeInstanceOf(
          AgencyRegistrationDocumentIntegrityError,
        );
      },
    );

    it(
      "rejects content whose SHA-256 differs from persisted metadata",
      async () => {
        const expectedContent =
          Buffer.from(
            "expected-content",
            "utf8",
          );

        const tamperedContent =
          Buffer.from(
            "tampered-contenT",
            "utf8",
          );

        expect(tamperedContent.byteLength)
          .toBe(expectedContent.byteLength);

        const document = documentFixture({
          sizeBytes:
            expectedContent.byteLength,
          checksumSha256: createHash("sha256")
            .update(expectedContent)
            .digest("hex"),
        });

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(
              vi.fn(async () => document),
            ),
            storage(
              vi.fn(async () =>
                Object.freeze({
                  content: tamperedContent,
                }),
              ),
            ),
          );

        await expect(
          useCase.execute({
            authority: AUTHORITY,
            registrationId:
              document.registrationId,
            documentId: document.documentId,
          }),
        ).rejects.toBeInstanceOf(
          AgencyRegistrationDocumentIntegrityError,
        );
      },
    );

    it(
      "rejects an authority without the retrieval grant before accessing persistence or storage",
      async () => {
        const findDocument = vi.fn();
        const retrieve = vi.fn();

        const useCase =
          new RetrieveAgencyRegistrationDocumentContent(
            queryStore(findDocument),
            storage(retrieve),
          );

        await expect(
          useCase.execute({
            authority: FORBIDDEN_AUTHORITY,
            registrationId: randomUUID(),
            documentId: randomUUID(),
          }),
        ).rejects.toBeInstanceOf(
          AgencyOnboardingForbiddenError,
        );

        expect(findDocument)
          .not.toHaveBeenCalled();

        expect(retrieve)
          .not.toHaveBeenCalled();
      },
    );
  },
);
