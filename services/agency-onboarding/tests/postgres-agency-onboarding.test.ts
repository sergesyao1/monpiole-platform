import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  AgencyDocumentStorageKeyConflictError,
  AgencyOnboardingForbiddenError,
  AgencyRegistrationDocumentUploadConsumedError,
  AgencyRegistrationDocumentUploadDuplicateError,
  AgencyRegistrationDocumentUploadExpiredError,
  AgencyRegistrationDocumentUploadNotFoundError,
  AgencyRegistrationNotFoundError,
  AgencyRegistrationNumberConflictError,
  ApproveAgencyRegistration,
  InvalidAgencyRegistrationTransitionError,
  PostgresAgencyRegistrationQueryStore,
  PostgresAgencyRegistrationReviewUnitOfWork,
  PostgresSubmitAgencyRegistrationStore,
  RejectAgencyRegistration,
  StartAgencyRegistrationReview,
  withAgencyOnboardingPostgresTransaction,
  type AgencyRegistration,
} from "../src/index.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";

const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;

function connectionString(
  user: string,
  password: string,
): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/agency_onboarding_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "agency_onboarding_test",
      POSTGRES_PASSWORD: OWNER_PASSWORD,
      POSTGRES_USER: "migration_owner",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage(
        /database system is ready to accept connections/,
        2,
      ),
    )
    .start();

  ownerPool = new Pool({
    connectionString: connectionString(
      "migration_owner",
      OWNER_PASSWORD,
    ),
  });

  await ownerPool.query(`
    CREATE ROLE monpiole_runtime
      LOGIN
      PASSWORD '${RUNTIME_PASSWORD}'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS
  `);

  await migrate(
    drizzle(ownerPool),
    { migrationsFolder },
  );

  await ownerPool.query(`
    GRANT USAGE
    ON SCHEMA agency_onboarding
    TO monpiole_runtime
  `);

  runtimePool = new Pool({
    connectionString: connectionString(
      "monpiole_runtime",
      RUNTIME_PASSWORD,
    ),
    max: 4,
  });
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

function registration(): AgencyRegistration {
  const now = "2026-09-15T15:00:00.000Z";

  return Object.freeze({
    id: randomUUID(),
    status: "SUBMITTED",

    agencyLegalName: "Agence Test CI SARL",
    agencyTradeName: "Agence Test",
    registrationNumber: `CI-ABJ-${randomUUID()}`,

    phone: "+2250102030405",
    email: `agency-${randomUUID()}@example.invalid`,

    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",

    contactFirstName: "Awa",
    contactLastName: "Kone",
    contactEmail: `contact-${randomUUID()}@example.invalid`,
    contactPhone: "+2250506070809",

    submittedAt: now,
    correlationId: randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}

async function stageAgencyDocumentUpload(input: {
  uploadId: string;
  storageKey: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  createdAt?: string;
  expiresAt?: string;
  consumedAt?: string | null;
}): Promise<void> {
  await ownerPool.query(
    `INSERT INTO agency_onboarding.agency_registration_document_uploads (
       upload_id,
       storage_key,
       original_filename,
       mime_type,
       size_bytes,
       checksum_sha256,
       created_at,
       expires_at,
       consumed_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.uploadId,
      input.storageKey,
      input.originalFilename ?? "rccm.pdf",
      input.mimeType ?? "application/pdf",
      input.sizeBytes ?? 1024,
      input.checksumSha256 ??
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      input.createdAt ?? "2026-09-15T14:00:00.000Z",
      input.expiresAt ?? "2026-09-15T16:00:00.000Z",
      input.consumedAt ?? null,
    ],
  );
}
describe("Agency onboarding PostgreSQL RLS", () => {
  it("allows submit capability to create a registration", async () => {
    const value = registration();

    const store =
      new PostgresSubmitAgencyRegistrationStore(runtimePool);

    await store.submit({
      registration: value,
      documents: [],
    });

    const persisted = await ownerPool.query(
      `SELECT status
         FROM agency_onboarding.agency_registrations
        WHERE registration_id = $1`,
      [value.id],
    );

    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]?.status).toBe("SUBMITTED");
  });

  it("translates duplicate registration number into a domain conflict", async () => {
    const original = registration();
    const duplicate = Object.freeze({
      ...registration(),
      registrationNumber: original.registrationNumber,
    });

    const store =
      new PostgresSubmitAgencyRegistrationStore(runtimePool);

    await store.submit({
      registration: original,
      documents: [],
    });

    await expect(
      store.submit({
        registration: duplicate,
        documents: [],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNumberConflictError,
    );

    const persisted = await ownerPool.query<{
      registration_id: string;
    }>(
      `SELECT registration_id
         FROM agency_onboarding.agency_registrations
        WHERE registration_id = ANY($1::uuid[])
        ORDER BY registration_id`,
      [[original.id, duplicate.id]],
    );

    expect(
      persisted.rows.map((row) => row.registration_id),
    ).toEqual([original.id]);
  });

  it("consumes a valid staged upload and persists trusted metadata", async () => {
    const value = registration();
    const uploadId = randomUUID();
    const storageKey =
      `agency-registration-uploads/${randomUUID()}`;

    await stageAgencyDocumentUpload({
      uploadId,
      storageKey,
      originalFilename: "registre-commerce.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-09-15T14:00:00.000Z",
      expiresAt: "2026-09-15T16:00:00.000Z",
    });

    const documentId = randomUUID();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [
        {
          documentId,
          documentType: "REGISTRATION_CERTIFICATE",
          uploadId,
        },
      ],
    });

    const persistedDocument = await ownerPool.query<{
      document_id: string;
      registration_id: string;
      document_type: string;
      storage_key: string;
      original_filename: string;
      mime_type: string;
      size_bytes: string;
      checksum_sha256: string;
      created_at: Date;
    }>(
      `SELECT
         document_id,
         registration_id,
         document_type,
         storage_key,
         original_filename,
         mime_type,
         size_bytes,
         checksum_sha256,
         created_at
       FROM agency_onboarding.agency_registration_documents
       WHERE document_id = $1`,
      [documentId],
    );

    expect(persistedDocument.rows).toHaveLength(1);

    expect(persistedDocument.rows[0]).toMatchObject({
      document_id: documentId,
      registration_id: value.id,
      document_type: "REGISTRATION_CERTIFICATE",
      storage_key: storageKey,
      original_filename: "registre-commerce.pdf",
      mime_type: "application/pdf",
      size_bytes: "4096",
      checksum_sha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(
      persistedDocument.rows[0]?.created_at.toISOString(),
    ).toBe("2026-09-15T14:00:00.000Z");

    const [retrievedDocument] =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).listDocuments(value.id);

    expect(retrievedDocument).toMatchObject({
      documentId,
      sizeBytes: 4096,
    });
    expect(typeof retrievedDocument?.sizeBytes).toBe("number");

    const staged = await ownerPool.query<{
      consumed_at: Date | null;
    }>(
      `SELECT consumed_at
       FROM agency_onboarding.agency_registration_document_uploads
       WHERE upload_id = $1`,
      [uploadId],
    );

    expect(staged.rows).toHaveLength(1);
    expect(staged.rows[0]?.consumed_at?.toISOString()).toBe(
      value.submittedAt,
    );
  });

  it("rejects an unknown staged upload and does not create the registration", async () => {
    const value = registration();

    await expect(
      new PostgresSubmitAgencyRegistrationStore(
        runtimePool,
      ).submit({
        registration: value,
        documents: [
          {
            documentId: randomUUID(),
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId: randomUUID(),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationDocumentUploadNotFoundError,
    );

    const persisted = await ownerPool.query(
      `SELECT registration_id
       FROM agency_onboarding.agency_registrations
       WHERE registration_id = $1`,
      [value.id],
    );

    expect(persisted.rows).toHaveLength(0);
  });

  it("rejects an expired staged upload and does not create the registration", async () => {
    const value = registration();
    const uploadId = randomUUID();

    await stageAgencyDocumentUpload({
      uploadId,
      storageKey: `agency-registration-uploads/${randomUUID()}`,
      createdAt: "2026-09-15T13:00:00.000Z",
      expiresAt: "2026-09-15T14:59:59.000Z",
    });

    await expect(
      new PostgresSubmitAgencyRegistrationStore(
        runtimePool,
      ).submit({
        registration: value,
        documents: [
          {
            documentId: randomUUID(),
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationDocumentUploadExpiredError,
    );

    const persisted = await ownerPool.query(
      `SELECT registration_id
       FROM agency_onboarding.agency_registrations
       WHERE registration_id = $1`,
      [value.id],
    );

    expect(persisted.rows).toHaveLength(0);

    const staged = await ownerPool.query<{
      consumed_at: Date | null;
    }>(
      `SELECT consumed_at
       FROM agency_onboarding.agency_registration_document_uploads
       WHERE upload_id = $1`,
      [uploadId],
    );

    expect(staged.rows[0]?.consumed_at).toBeNull();
  });

  it("rejects an already-consumed staged upload", async () => {
    const value = registration();
    const uploadId = randomUUID();

    await stageAgencyDocumentUpload({
      uploadId,
      storageKey: `agency-registration-uploads/${randomUUID()}`,
      createdAt: "2026-09-15T13:00:00.000Z",
      expiresAt: "2026-09-15T16:00:00.000Z",
      consumedAt: "2026-09-15T14:30:00.000Z",
    });

    await expect(
      new PostgresSubmitAgencyRegistrationStore(
        runtimePool,
      ).submit({
        registration: value,
        documents: [
          {
            documentId: randomUUID(),
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationDocumentUploadConsumedError,
    );
  });

  it("rejects a duplicate staged upload id in the same submission", async () => {
    const value = registration();
    const uploadId = randomUUID();

    await stageAgencyDocumentUpload({
      uploadId,
      storageKey: `agency-registration-uploads/${randomUUID()}`,
    });

    await expect(
      new PostgresSubmitAgencyRegistrationStore(
        runtimePool,
      ).submit({
        registration: value,
        documents: [
          {
            documentId: randomUUID(),
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId,
          },
          {
            documentId: randomUUID(),
            documentType: "TAX_CERTIFICATE",
            uploadId,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationDocumentUploadDuplicateError,
    );

    const staged = await ownerPool.query<{
      consumed_at: Date | null;
    }>(
      `SELECT consumed_at
       FROM agency_onboarding.agency_registration_document_uploads
       WHERE upload_id = $1`,
      [uploadId],
    );

    expect(staged.rows[0]?.consumed_at).toBeNull();
  });

  it("rolls back staged upload consumption when registration insertion fails", async () => {
    const original = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: original,
      documents: [],
    });

    const conflicting = Object.freeze({
      ...registration(),
      registrationNumber: original.registrationNumber,
    });

    const uploadId = randomUUID();

    await stageAgencyDocumentUpload({
      uploadId,
      storageKey: `agency-registration-uploads/${randomUUID()}`,
    });

    await expect(
      new PostgresSubmitAgencyRegistrationStore(
        runtimePool,
      ).submit({
        registration: conflicting,
        documents: [
          {
            documentId: randomUUID(),
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNumberConflictError,
    );

    const staged = await ownerPool.query<{
      consumed_at: Date | null;
    }>(
      `SELECT consumed_at
       FROM agency_onboarding.agency_registration_document_uploads
       WHERE upload_id = $1`,
      [uploadId],
    );

    expect(staged.rows).toHaveLength(1);
    expect(staged.rows[0]?.consumed_at).toBeNull();

    const rolledBackRegistration = await ownerPool.query(
      `SELECT registration_id
       FROM agency_onboarding.agency_registrations
       WHERE registration_id = $1`,
      [conflicting.id],
    );

    expect(rolledBackRegistration.rows).toHaveLength(0);
  });
  it("fails closed without an agency capability", async () => {
    await expect(
      runtimePool.query(
        `SELECT *
           FROM agency_onboarding.agency_registrations`,
      ),
    ).resolves.toMatchObject({
      rows: [],
    });

    await expect(
      runtimePool.query(
        `INSERT INTO agency_onboarding.agency_registrations (
           registration_id,
           status,
           agency_legal_name,
           registration_number,
           phone,
           email,
           address,
           city,
           country_code,
           contact_first_name,
           contact_last_name,
           contact_email,
           contact_phone,
           submitted_at,
           created_at,
           updated_at,
           correlation_id
         ) VALUES (
           $1,
           'SUBMITTED',
           'Blocked Agency',
           $2,
           '+2250102030405',
           $3,
           'Abidjan',
           'Abidjan',
           'CI',
           'Awa',
           'Kone',
           $4,
           '+2250506070809',
           now(),
           now(),
           now(),
           $5
         )`,
        [
          randomUUID(),
          `BLOCKED-${randomUUID()}`,
          `blocked-${randomUUID()}@example.invalid`,
          `blocked-contact-${randomUUID()}@example.invalid`,
          randomUUID(),
        ],
      ),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("does not allow submit capability to read registrations", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    await withAgencyOnboardingPostgresTransaction(
      runtimePool,
      "submit",
      async (scope) => {
        const rows = await scope.query<Record<string, unknown>>(
          `SELECT *
             FROM agency_onboarding.agency_registrations
            WHERE registration_id = $1`,
          [value.id],
        );

        expect(rows).toHaveLength(0);
      },
    );
  });

  it("allows retrieve capability to read registrations", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const result =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).findById(value.id);

    expect(result).toMatchObject({
      id: value.id,
      status: "SUBMITTED",
      agencyLegalName: value.agencyLegalName,
      registrationNumber: value.registrationNumber,
    });
  });

  it("does not allow retrieve capability to update registrations", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const before = await ownerPool.query(
      `SELECT updated_at
         FROM agency_onboarding.agency_registrations
        WHERE registration_id = $1`,
      [value.id],
    );

    await withAgencyOnboardingPostgresTransaction(
      runtimePool,
      "retrieve",
      async (scope) => {
        const rows = await scope.query<{ registration_id: string }>(
          `UPDATE agency_onboarding.agency_registrations
              SET updated_at = now() + interval '1 hour'
            WHERE registration_id = $1
            RETURNING registration_id`,
          [value.id],
        );

        expect(rows).toHaveLength(0);
      },
    );

    const after = await ownerPool.query(
      `SELECT updated_at
         FROM agency_onboarding.agency_registrations
        WHERE registration_id = $1`,
      [value.id],
    );

    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]?.updated_at.toISOString()).toBe(
      before.rows[0]?.updated_at.toISOString(),
    );
  });

  it("holds the row lock for the whole review unit of work", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(
        runtimePool,
      );

    let releaseFirst!: () => void;

    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    let firstLocked!: () => void;

    const firstHasLock = new Promise<void>((resolve) => {
      firstLocked = resolve;
    });

    let secondLocked = false;

    const first = unitOfWork.execute(
      "review",
      async (transaction) => {
        const locked = await transaction.findForUpdate(value.id);

        expect(locked?.id).toBe(value.id);

        firstLocked();

        await firstCanFinish;
      },
    );

    await firstHasLock;

    const second = unitOfWork.execute(
      "review",
      async (transaction) => {
        const locked = await transaction.findForUpdate(value.id);

        expect(locked?.id).toBe(value.id);

        secondLocked = true;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(secondLocked).toBe(false);

    releaseFirst();

    await first;
    await second;

    expect(secondLocked).toBe(true);
  });

  it("starts review and persists the reviewer atomically", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const useCase = new StartAgencyRegistrationReview(
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
      { now: () => "2026-09-15T16:10:00.000Z" },
    );

    const authority = {
      actorId: randomUUID(),
      authorityId: randomUUID(),
      grants: ["REVIEW_AGENCY_REGISTRATIONS"] as const,
    };

    const result = await useCase.execute({
      authority,
      registrationId: value.id,
    });

    expect(result).toMatchObject({
      id: value.id,
      status: "UNDER_REVIEW",
      reviewedByIdentityId: authority.actorId,
      reviewStartedAt: "2026-09-15T16:10:00.000Z",
      updatedAt: "2026-09-15T16:10:00.000Z",
    });

    const persisted =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).findById(value.id);

    expect(persisted).toMatchObject({
      status: "UNDER_REVIEW",
      reviewedByIdentityId: authority.actorId,
      reviewStartedAt: "2026-09-15T16:10:00.000Z",
    });
  });

  it("keeps start-review idempotent for the same reviewer", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const authority = {
      actorId: randomUUID(),
      authorityId: randomUUID(),
      grants: ["REVIEW_AGENCY_REGISTRATIONS"] as const,
    };

    const first = new StartAgencyRegistrationReview(
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
      { now: () => "2026-09-15T16:20:00.000Z" },
    );

    const second = new StartAgencyRegistrationReview(
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
      { now: () => "2026-09-15T17:20:00.000Z" },
    );

    const initial = await first.execute({
      authority,
      registrationId: value.id,
    });

    const replay = await second.execute({
      authority,
      registrationId: value.id,
    });

    expect(replay).toEqual(initial);
    expect(replay.reviewStartedAt).toBe(
      "2026-09-15T16:20:00.000Z",
    );
    expect(replay.updatedAt).toBe(
      "2026-09-15T16:20:00.000Z",
    );
  });

  it("does not allow another reviewer to take over implicitly", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const first = new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T16:30:00.000Z" },
    );

    await first.execute({
      authority: {
        actorId: randomUUID(),
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const second = new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T16:40:00.000Z" },
    );

    await expect(
      second.execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["REVIEW_AGENCY_REGISTRATIONS"],
        },
        registrationId: value.id,
      }),
    ).rejects.toBeInstanceOf(
      InvalidAgencyRegistrationTransitionError,
    );
  });

  it("rejects an under-review registration and persists the reason", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const reviewerId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T16:50:00.000Z" },
    ).execute({
      authority: {
        actorId: reviewerId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const result = await new RejectAgencyRegistration(
      unitOfWork,
      { now: () => "2026-09-15T17:00:00.000Z" },
    ).execute({
      authority: {
        actorId: reviewerId,
        authorityId: randomUUID(),
        grants: ["DECIDE_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
      rejectionReason: "  Documents incomplets  ",
    });

    expect(result).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Documents incomplets",
      rejectedAt: "2026-09-15T17:00:00.000Z",
      updatedAt: "2026-09-15T17:00:00.000Z",
    });
  });

  it("does not allow rejection directly from submitted", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const useCase = new RejectAgencyRegistration(
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
      { now: () => "2026-09-15T17:10:00.000Z" },
    );

    await expect(
      useCase.execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["DECIDE_AGENCY_REGISTRATIONS"],
        },
        registrationId: value.id,
        rejectionReason: "Non conforme",
      }),
    ).rejects.toBeInstanceOf(
      InvalidAgencyRegistrationTransitionError,
    );
  });

  it("keeps an identical rejection replay idempotent", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T17:20:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const authority = {
      actorId,
      authorityId: randomUUID(),
      grants: ["DECIDE_AGENCY_REGISTRATIONS"] as const,
    };

    const first = await new RejectAgencyRegistration(
      unitOfWork,
      { now: () => "2026-09-15T17:30:00.000Z" },
    ).execute({
      authority,
      registrationId: value.id,
      rejectionReason: "PiÃƒÂ¨ce invalide",
    });

    const replay = await new RejectAgencyRegistration(
      unitOfWork,
      { now: () => "2026-09-15T18:30:00.000Z" },
    ).execute({
      authority,
      registrationId: value.id,
      rejectionReason: "PiÃƒÂ¨ce invalide",
    });

    expect(replay).toEqual(first);
    expect(replay.rejectedAt).toBe(
      "2026-09-15T17:30:00.000Z",
    );
  });

  it("rejects a different reason after a terminal rejection", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T17:40:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const reject = new RejectAgencyRegistration(
      unitOfWork,
      { now: () => "2026-09-15T17:50:00.000Z" },
    );

    const authority = {
      actorId,
      authorityId: randomUUID(),
      grants: ["DECIDE_AGENCY_REGISTRATIONS"] as const,
    };

    await reject.execute({
      authority,
      registrationId: value.id,
      rejectionReason: "Premier motif",
    });

    await expect(
      reject.execute({
        authority,
        registrationId: value.id,
        rejectionReason: "Autre motif",
      }),
    ).rejects.toBeInstanceOf(
      InvalidAgencyRegistrationTransitionError,
    );
  });

  it("fails closed when the required platform grant is missing", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(
      runtimePool,
    ).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    await expect(
      new StartAgencyRegistrationReview(
        unitOfWork,
        { now: () => "2026-09-15T18:00:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: [],
        },
        registrationId: value.id,
      }),
    ).rejects.toBeInstanceOf(
      AgencyOnboardingForbiddenError,
    );

    await expect(
      new RejectAgencyRegistration(
        unitOfWork,
        { now: () => "2026-09-15T18:00:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: [],
        },
        registrationId: value.id,
        rejectionReason: "Non conforme",
      }),
    ).rejects.toBeInstanceOf(
      AgencyOnboardingForbiddenError,
    );
  });

  it("returns not-found for an unknown registration", async () => {
    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    await expect(
      new StartAgencyRegistrationReview(
        unitOfWork,
        { now: () => "2026-09-15T18:10:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["REVIEW_AGENCY_REGISTRATIONS"],
        },
        registrationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNotFoundError,
    );

    await expect(
      new RejectAgencyRegistration(
        unitOfWork,
        { now: () => "2026-09-15T18:10:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["DECIDE_AGENCY_REGISTRATIONS"],
        },
        registrationId: randomUUID(),
        rejectionReason: "Non conforme",
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNotFoundError,
    );
  });

  it("approves an under-review registration with a pending tenant", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T18:20:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const tenantId = randomUUID();
    const calls: string[] = [];

    const result = await new ApproveAgencyRegistration(
      unitOfWork,
      {
        async provision(input) {
          calls.push(input.idempotencyKey);

          expect(input.registration.id).toBe(value.id);
          expect(input.registration.status).toBe("UNDER_REVIEW");

          return {
            tenantId,
            lifecycleState: "PENDING",
          };
        },
      },
      { now: () => "2026-09-15T18:30:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["DECIDE_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    expect(calls).toEqual([
      `agency-registration:${value.id}`,
    ]);

    expect(result).toMatchObject({
      status: "APPROVED",
      provisionedTenantId: tenantId,
      approvedAt: "2026-09-15T18:30:00.000Z",
      updatedAt: "2026-09-15T18:30:00.000Z",
    });

    const persisted =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).findById(value.id);

    expect(persisted).toMatchObject({
      status: "APPROVED",
      provisionedTenantId: tenantId,
    });
  });

  it("does not provision a tenant when approval is attempted from submitted", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    let provisionCalls = 0;

    await expect(
      new ApproveAgencyRegistration(
        new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
        {
          async provision() {
            provisionCalls += 1;

            return {
              tenantId: randomUUID(),
              lifecycleState: "PENDING",
            };
          },
        },
        { now: () => "2026-09-15T18:40:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["DECIDE_AGENCY_REGISTRATIONS"],
        },
        registrationId: value.id,
      }),
    ).rejects.toBeInstanceOf(
      InvalidAgencyRegistrationTransitionError,
    );

    expect(provisionCalls).toBe(0);
  });

  it("fails closed before provisioning when decide grant is missing", async () => {
    let provisionCalls = 0;

    await expect(
      new ApproveAgencyRegistration(
        new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
        {
          async provision() {
            provisionCalls += 1;

            return {
              tenantId: randomUUID(),
              lifecycleState: "PENDING",
            };
          },
        },
        { now: () => "2026-09-15T18:50:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: [],
        },
        registrationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(
      AgencyOnboardingForbiddenError,
    );

    expect(provisionCalls).toBe(0);
  });

  it("returns not-found before provisioning for an unknown registration", async () => {
    let provisionCalls = 0;

    await expect(
      new ApproveAgencyRegistration(
        new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool),
        {
          async provision() {
            provisionCalls += 1;

            return {
              tenantId: randomUUID(),
              lifecycleState: "PENDING",
            };
          },
        },
        { now: () => "2026-09-15T19:00:00.000Z" },
      ).execute({
        authority: {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: ["DECIDE_AGENCY_REGISTRATIONS"],
        },
        registrationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNotFoundError,
    );

    expect(provisionCalls).toBe(0);
  });

  it("keeps an already-approved registration idempotent without provisioning again", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T19:10:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const tenantId = randomUUID();
    let provisionCalls = 0;

    const tenantProvisioning = {
      async provision() {
        provisionCalls += 1;

        return {
          tenantId,
          lifecycleState: "PENDING" as const,
        };
      },
    };

    const authority = {
      actorId,
      authorityId: randomUUID(),
      grants: ["DECIDE_AGENCY_REGISTRATIONS"] as const,
    };

    const first = await new ApproveAgencyRegistration(
      unitOfWork,
      tenantProvisioning,
      { now: () => "2026-09-15T19:20:00.000Z" },
    ).execute({
      authority,
      registrationId: value.id,
    });

    const replay = await new ApproveAgencyRegistration(
      unitOfWork,
      tenantProvisioning,
      { now: () => "2026-09-15T20:20:00.000Z" },
    ).execute({
      authority,
      registrationId: value.id,
    });

    expect(replay).toEqual(first);
    expect(provisionCalls).toBe(1);
  });

  it("allows another reviewer to resume approval after a crash with the same provisioning key", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T19:30:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const tenantId = randomUUID();
    const keys: string[] = [];
    let attempts = 0;

    const provisioning = {
      async provision(input: {
        idempotencyKey: string;
      }) {
        keys.push(input.idempotencyKey);
        attempts += 1;

        if (attempts === 1) {
          throw new Error(
            "Simulated crash after external tenant provisioning",
          );
        }

        return {
          tenantId,
          lifecycleState: "PENDING" as const,
        };
      },
    };

    const reviewerAAuthority = {
      actorId,
      authorityId: randomUUID(),
      grants: ["DECIDE_AGENCY_REGISTRATIONS"] as const,
    };

    const reviewerBAuthority = {
      actorId: randomUUID(),
      authorityId: randomUUID(),
      grants: ["DECIDE_AGENCY_REGISTRATIONS"] as const,
    };

    expect(reviewerBAuthority.actorId).not.toBe(
      reviewerAAuthority.actorId,
    );
    expect(reviewerBAuthority.authorityId).not.toBe(
      reviewerAAuthority.authorityId,
    );

    const useCase = new ApproveAgencyRegistration(
      unitOfWork,
      provisioning,
      { now: () => "2026-09-15T19:40:00.000Z" },
    );

    await expect(
      useCase.execute({
        authority: reviewerAAuthority,
        registrationId: value.id,
      }),
    ).rejects.toThrow(
      "Simulated crash after external tenant provisioning",
    );

    const afterFailure =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).findById(value.id);

    expect(afterFailure).toMatchObject({
      status: "UNDER_REVIEW",
      reviewedByIdentityId: actorId,
      approvalProvisioningStartedAt:
        "2026-09-15T19:40:00.000Z",
    });
    expect(afterFailure?.provisionedTenantId).toBeUndefined();

    const approved = await useCase.execute({
      authority: reviewerBAuthority,
      registrationId: value.id,
    });

    expect(keys).toEqual([
      `agency-registration:${value.id}`,
      `agency-registration:${value.id}`,
    ]);

    expect(approved).toMatchObject({
      status: "APPROVED",
      reviewedByIdentityId: actorId,
      approvalProvisioningStartedAt:
        "2026-09-15T19:40:00.000Z",
      provisionedTenantId: tenantId,
    });
  });

  it("refuses rejection after the durable approval claim and completes approval", async () => {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-15T19:50:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const tenantId = randomUUID();
    let rejectionWasRefused = false;

    const approval = new ApproveAgencyRegistration(
      unitOfWork,
      {
        async provision() {
          await expect(
            new RejectAgencyRegistration(
              unitOfWork,
              { now: () => "2026-09-15T20:00:00.000Z" },
            ).execute({
              authority: {
                actorId,
                authorityId: randomUUID(),
                grants: ["DECIDE_AGENCY_REGISTRATIONS"],
              },
              registrationId: value.id,
              rejectionReason: "Concurrent decision",
            }),
          ).rejects.toBeInstanceOf(
            InvalidAgencyRegistrationTransitionError,
          );

          rejectionWasRefused = true;

          const claimed =
            await new PostgresAgencyRegistrationQueryStore(
              runtimePool,
            ).findById(value.id);

          expect(claimed).toMatchObject({
            status: "UNDER_REVIEW",
            approvalProvisioningStartedAt:
              "2026-09-15T20:10:00.000Z",
          });

          expect(claimed?.rejectionReason).toBeUndefined();

          return {
            tenantId,
            lifecycleState: "PENDING" as const,
          };
        },
      },
      { now: () => "2026-09-15T20:10:00.000Z" },
    );

    const approved = await approval.execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["DECIDE_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    expect(rejectionWasRefused).toBe(true);

    expect(approved).toMatchObject({
      status: "APPROVED",
      approvalProvisioningStartedAt:
        "2026-09-15T20:10:00.000Z",
      provisionedTenantId: tenantId,
    });

    const persisted =
      await new PostgresAgencyRegistrationQueryStore(
        runtimePool,
      ).findById(value.id);

    expect(persisted).toMatchObject({
      status: "APPROVED",
      approvalProvisioningStartedAt:
        "2026-09-15T20:10:00.000Z",
      provisionedTenantId: tenantId,
    });

    expect(persisted?.rejectionReason).toBeUndefined();
  });

});

describe("First administrator bootstrap persistence", () => {
  async function createApprovedRegistration(): Promise<{
    registrationId: string;
    tenantId: string;
  }> {
    const value = registration();

    await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
      registration: value,
      documents: [],
    });

    const unitOfWork =
      new PostgresAgencyRegistrationReviewUnitOfWork(runtimePool);

    const actorId = randomUUID();

    await new StartAgencyRegistrationReview(
      unitOfWork,
      { now: () => "2026-09-18T10:00:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["REVIEW_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    const tenantId = randomUUID();

    await new ApproveAgencyRegistration(
      unitOfWork,
      {
        async provision() {
          return {
            tenantId,
            lifecycleState: "PENDING" as const,
          };
        },
      },
      { now: () => "2026-09-18T10:10:00.000Z" },
    ).execute({
      authority: {
        actorId,
        authorityId: randomUUID(),
        grants: ["DECIDE_AGENCY_REGISTRATIONS"],
      },
      registrationId: value.id,
    });

    return {
      registrationId: value.id,
      tenantId,
    };
  }

  async function insertAdministrator(input: {
    registrationId: string;
    tenantId: string;
    internalIdentityId?: string;
    tokenHash?: string;
    status?: string;
    createdAt?: string;
    expiresAt?: string;
    consumedAt?: string | null;
    identityLinkedAt?: string | null;
    activatedAt?: string | null;
    cancelledAt?: string | null;
  }): Promise<void> {
    await withAgencyOnboardingPostgresTransaction(
      runtimePool,
      "administrator",
      async (scope) => {
        await scope.query(
          `INSERT INTO agency_onboarding.agency_registration_administrators (
             registration_id,
             tenant_id,
             internal_identity_id,
             administrator_kind,
             status,
             bootstrap_token_hash,
             bootstrap_token_expires_at,
             bootstrap_token_consumed_at,
             created_by_platform_identity_id,
             created_at,
             identity_linked_at,
             activated_at,
             cancelled_at
           ) VALUES (
             $1,$2,$3,'FIRST_ADMINISTRATOR',$4,$5,$6,$7,$8,$9,$10,$11,$12
           )`,
          [
            input.registrationId,
            input.tenantId,
            input.internalIdentityId ?? randomUUID(),
            input.status ?? "PENDING_IDENTITY",
            input.tokenHash ??
              `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`,
            input.expiresAt ?? "2026-09-18T12:00:00.000Z",
            input.consumedAt ?? null,
            randomUUID(),
            input.createdAt ?? "2026-09-18T11:00:00.000Z",
            input.identityLinkedAt ?? null,
            input.activatedAt ?? null,
            input.cancelledAt ?? null,
          ],
        );
      },
    );
  }

  it("fails closed without administrator capability", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      runtimePool.query(
        `INSERT INTO agency_onboarding.agency_registration_administrators (
           registration_id,
           tenant_id,
           internal_identity_id,
           administrator_kind,
           status,
           bootstrap_token_hash,
           bootstrap_token_expires_at,
           created_by_platform_identity_id,
           created_at
         ) VALUES (
           $1,$2,$3,'FIRST_ADMINISTRATOR','PENDING_IDENTITY',$4,$5,$6,$7
         )`,
        [
          registrationId,
          tenantId,
          randomUUID(),
          "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          "2026-09-18T12:00:00.000Z",
          randomUUID(),
          "2026-09-18T11:00:00.000Z",
        ],
      ),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("allows administrator capability to persist a pending first administrator", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    const internalIdentityId = randomUUID();
    const tokenHash =
      "5656565656565656565656565656565656565656565656565656565656565656";

    await insertAdministrator({
      registrationId,
      tenantId,
      internalIdentityId,
      tokenHash,
    });

    const persisted = await ownerPool.query<{
      registration_id: string;
      tenant_id: string;
      internal_identity_id: string;
      administrator_kind: string;
      status: string;
      bootstrap_token_hash: string;
    }>(
      `SELECT
         registration_id,
         tenant_id,
         internal_identity_id,
         administrator_kind,
         status,
         bootstrap_token_hash
       FROM agency_onboarding.agency_registration_administrators
       WHERE registration_id = $1`,
      [registrationId],
    );

    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({
      registration_id: registrationId,
      tenant_id: tenantId,
      internal_identity_id: internalIdentityId,
      administrator_kind: "FIRST_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrap_token_hash: tokenHash,
    });
  });

  it("rejects an invalid bootstrap token hash", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      insertAdministrator({
        registrationId,
        tenantId,
        tokenHash: "not-a-sha256-hash",
      }),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects a bootstrap token that does not expire after creation", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      insertAdministrator({
        registrationId,
        tenantId,
        createdAt: "2026-09-18T11:00:00.000Z",
        expiresAt: "2026-09-18T11:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects an incoherent linked lifecycle", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      insertAdministrator({
        registrationId,
        tenantId,
        status: "IDENTITY_LINKED",
      }),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("accepts the identity-linked lifecycle", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await insertAdministrator({
      registrationId,
      tenantId,
      status: "IDENTITY_LINKED",
      consumedAt: "2026-09-18T11:10:00.000Z",
      identityLinkedAt: "2026-09-18T11:10:00.000Z",
    });
  });

  it("accepts the active lifecycle only after identity linkage", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await insertAdministrator({
      registrationId,
      tenantId,
      status: "ACTIVE",
      consumedAt: "2026-09-18T11:10:00.000Z",
      identityLinkedAt: "2026-09-18T11:10:00.000Z",
      activatedAt: "2026-09-18T11:20:00.000Z",
    });
  });

  it("rejects active without identity linkage", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      insertAdministrator({
        registrationId,
        tenantId,
        status: "ACTIVE",
        activatedAt: "2026-09-18T11:20:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("accepts the cancelled terminal lifecycle", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await insertAdministrator({
      registrationId,
      tenantId,
      status: "CANCELLED",
      cancelledAt: "2026-09-18T11:15:00.000Z",
    });
  });

  it("rejects a consumed timestamp before creation", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await expect(
      insertAdministrator({
        registrationId,
        tenantId,
        consumedAt: "2026-09-18T10:59:59.000Z",
      }),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("enforces one first administrator per registration", async () => {
    const { registrationId, tenantId } =
      await createApprovedRegistration();

    await insertAdministrator({
      registrationId,
      tenantId,
    });

    await expect(
      insertAdministrator({
        registrationId,
        tenantId: randomUUID(),
        tokenHash:
          "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      }),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("enforces one first administrator per tenant", async () => {
    const first = await createApprovedRegistration();
    const second = await createApprovedRegistration();

    await insertAdministrator({
      registrationId: first.registrationId,
      tenantId: first.tenantId,
    });

    await expect(
      insertAdministrator({
        registrationId: second.registrationId,
        tenantId: first.tenantId,
        tokenHash:
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("enforces unique internal identity provenance", async () => {
    const first = await createApprovedRegistration();
    const second = await createApprovedRegistration();

    const internalIdentityId = randomUUID();

    await insertAdministrator({
      registrationId: first.registrationId,
      tenantId: first.tenantId,
      internalIdentityId,
    });

    await expect(
      insertAdministrator({
        registrationId: second.registrationId,
        tenantId: second.tenantId,
        internalIdentityId,
        tokenHash:
          "abababababababababababababababababababababababababababababababab",
      }),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("enforces unique bootstrap token hashes", async () => {
    const first = await createApprovedRegistration();
    const second = await createApprovedRegistration();

    const tokenHash =
      "1212121212121212121212121212121212121212121212121212121212121212";

    await insertAdministrator({
      registrationId: first.registrationId,
      tenantId: first.tenantId,
      tokenHash,
    });

    await expect(
      insertAdministrator({
        registrationId: second.registrationId,
        tenantId: second.tenantId,
        tokenHash,
      }),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("enforces registration provenance through the foreign key", async () => {
    await expect(
      insertAdministrator({
        registrationId: randomUUID(),
        tenantId: randomUUID(),
        tokenHash:
          "3434343434343434343434343434343434343434343434343434343434343434",
      }),
    ).rejects.toMatchObject({
      code: "23503",
    });
  });
});
