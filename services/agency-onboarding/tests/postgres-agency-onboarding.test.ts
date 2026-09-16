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

  it("translates duplicate document storage key and rolls back the registration", async () => {
    const original = registration();
    const conflicting = registration();

    const storageKey =
      `agency-registration/test/${randomUUID()}/rccm.pdf`;

    const store =
      new PostgresSubmitAgencyRegistrationStore(runtimePool);

    await store.submit({
      registration: original,
      documents: [
        {
          documentId: randomUUID(),
          registrationId: original.id,
          documentType: "REGISTRATION_CERTIFICATE",
          storageKey,
          originalFilename: "rccm.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          checksumSha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          createdAt: original.createdAt,
        },
      ],
    });

    await expect(
      store.submit({
        registration: conflicting,
        documents: [
          {
            documentId: randomUUID(),
            registrationId: conflicting.id,
            documentType: "REGISTRATION_CERTIFICATE",
            storageKey,
            originalFilename: "rccm-duplicate.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            checksumSha256:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            createdAt: conflicting.createdAt,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(
      AgencyDocumentStorageKeyConflictError,
    );

    const rolledBackRegistration =
      await ownerPool.query(
        `SELECT registration_id
           FROM agency_onboarding.agency_registrations
          WHERE registration_id = $1`,
        [conflicting.id],
      );

    expect(rolledBackRegistration.rows).toHaveLength(0);

    const documents = await ownerPool.query<{
      registration_id: string;
    }>(
      `SELECT registration_id
         FROM agency_onboarding.agency_registration_documents
        WHERE storage_key = $1`,
      [storageKey],
    );

    expect(documents.rows).toHaveLength(1);
    expect(documents.rows[0]?.registration_id).toBe(
      original.id,
    );
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
      rejectionReason: "PiÃ¨ce invalide",
    });

    const replay = await new RejectAgencyRegistration(
      unitOfWork,
      { now: () => "2026-09-15T18:30:00.000Z" },
    ).execute({
      authority,
      registrationId: value.id,
      rejectionReason: "PiÃ¨ce invalide",
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