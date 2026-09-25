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
  PostgresFirstAdministratorBootstrapUnitOfWork,
  PostgresAgencyRegistrationQueryStore,
  PostgresSubmitAgencyRegistrationStore,
  type AgencyRegistration,
  type FirstAdministratorBootstrap,
} from "../src/index.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";

const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-agency-runtime-password";

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
  return (
    `postgresql://${user}:${password}` +
    `@${container.getHost()}` +
    `:${container.getMappedPort(5432)}` +
    "/first_admin_bootstrap_test"
  );
}

function registration(): AgencyRegistration {
  const now = "2026-09-18T12:00:00.000Z";

  return Object.freeze({
    id: randomUUID(),
    status: "SUBMITTED",
    agencyLegalName: "Agence First Admin CI",
    agencyTradeName: "First Admin Immobilier",
    registrationNumber: `CI-ABJ-${randomUUID()}`,
    taxIdentifier: `TAX-${randomUUID()}`,
    phone: "+2250102030405",
    email: `agency-${randomUUID()}@example.invalid`,
    website: "https://example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    contactFirstName: "Awa",
    contactLastName: "Kone",
    contactEmail:
      `contact-${randomUUID()}@example.invalid`,
    contactPhone: "+2250506070809",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    correlationId: randomUUID(),
  });
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "first_admin_bootstrap_test",
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

  await migrate(drizzle(ownerPool), {
    migrationsFolder,
    migrationsTable:
      "__drizzle_migrations_agency_onboarding",
    migrationsSchema: "drizzle",
  });

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA agency_onboarding TO monpiole_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA agency_onboarding TO monpiole_runtime",
  );

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

describe(
  "PostgresFirstAdministratorBootstrapUnitOfWork",
  () => {
    it(
      "persists and replays one first administrator bootstrap under administrator capability",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();

        /*
         * Upstream fixture only:
         * CreateFirstAgencyAdministrator requires APPROVED +
         * provisionedTenantId.
         */
        await ownerPool.query(
          `UPDATE agency_onboarding.agency_registrations
              SET status = 'APPROVED',
                  provisioned_tenant_id = $2,
                  reviewed_by_identity_id = $3,
                  review_started_at = $4,
                  approval_provisioning_started_at = $5,
                  approved_at = $6,
                  updated_at = $6
            WHERE registration_id = $1`,
          [
            value.id,
            tenantId,
            randomUUID(),
            "2026-09-18T12:05:00.000Z",
            "2026-09-18T12:10:00.000Z",
            "2026-09-18T12:15:00.000Z",
          ],
        );

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        const prepared = await unitOfWork.execute(
          async (transaction) => {
            const lockedRegistration =
              await transaction.findRegistrationForUpdate(
                value.id,
              );

            const existing =
              await transaction.findAdministratorByRegistration(
                value.id,
              );

            return {
              registration: lockedRegistration,
              existing,
            };
          },
        );

        expect(prepared.registration).toMatchObject({
          id: value.id,
          status: "APPROVED",
          provisionedTenantId: tenantId,
        });

        expect(prepared.existing).toBeUndefined();

        const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId: randomUUID(),
            invitedEmail: "administrator@example.test",
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash: "a".repeat(64),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:15:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt: "2026-09-18T12:15:00.000Z",
          });

        await unitOfWork.execute(async (transaction) => {
          const lockedRegistration =
            await transaction.findRegistrationForUpdate(
              value.id,
            );

          expect(lockedRegistration).toMatchObject({
            id: value.id,
            status: "APPROVED",
            provisionedTenantId: tenantId,
          });

          const existing =
            await transaction.findAdministratorByRegistration(
              value.id,
            );

          expect(existing).toBeUndefined();

          await transaction.insertAdministrator(
            administrator,
          );
        });

        const replayed = await unitOfWork.execute(
          async (transaction) => {
            await transaction.findRegistrationForUpdate(
              value.id,
            );

            return transaction.findAdministratorByRegistration(
              value.id,
            );
          },
        );

        expect(replayed).toEqual(administrator);

        const persisted = await ownerPool.query<{
          registration_id: string;
          tenant_id: string;
          internal_identity_id: string;
          administrator_kind: string;
          status: string;
          bootstrap_token_hash: string;
          created_by_platform_identity_id: string;
        }>(
          `SELECT
             registration_id,
             tenant_id,
             internal_identity_id,
             administrator_kind,
             status,
             bootstrap_token_hash,
             created_by_platform_identity_id
           FROM agency_onboarding.agency_registration_administrators
          WHERE registration_id = $1`,
          [value.id],
        );

        expect(persisted.rows).toHaveLength(1);

        expect(persisted.rows[0]).toEqual({
          registration_id: administrator.registrationId,
          tenant_id: administrator.tenantId,
          internal_identity_id:
            administrator.internalIdentityId,
          administrator_kind: "FIRST_ADMINISTRATOR",
          status: "PENDING_IDENTITY",
          bootstrap_token_hash:
            administrator.bootstrapTokenHash,
          created_by_platform_identity_id:
            administrator.createdByPlatformIdentityId,
        });

        const count = await ownerPool.query<{
          count: string;
        }>(
          `SELECT count(*)::text AS count
             FROM agency_onboarding.agency_registration_administrators
            WHERE registration_id = $1`,
          [value.id],
        );

        expect(count.rows[0]?.count).toBe("1");
      },
    );

    it(
      "serializes concurrent first administrator bootstrap transactions for the same registration",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();

        await ownerPool.query(
          `UPDATE agency_onboarding.agency_registrations
              SET status = 'APPROVED',
                  provisioned_tenant_id = $2,
                  reviewed_by_identity_id = $3,
                  review_started_at = $4,
                  approval_provisioning_started_at = $5,
                  approved_at = $6,
                  updated_at = $6
            WHERE registration_id = $1`,
          [
            value.id,
            tenantId,
            randomUUID(),
            "2026-09-18T12:05:00.000Z",
            "2026-09-18T12:10:00.000Z",
            "2026-09-18T12:15:00.000Z",
          ],
        );

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        let releaseFirst!: () => void;

        const holdFirst = new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });

        let firstHasLock!: () => void;

        const firstLocked = new Promise<void>((resolve) => {
          firstHasLock = resolve;
        });

        const first = unitOfWork.execute(
          async (transaction) => {
            const locked =
              await transaction.findRegistrationForUpdate(
                value.id,
              );

            expect(locked).toMatchObject({
              id: value.id,
              status: "APPROVED",
              provisionedTenantId: tenantId,
            });

            firstHasLock();

            await holdFirst;

            return "first";
          },
        );

        await firstLocked;

        let secondEntered!: () => void;

        const secondStarted = new Promise<void>((resolve) => {
          secondEntered = resolve;
        });

        let secondCompleted = false;

        const second = unitOfWork.execute(
          async (transaction) => {
            secondEntered();

            const locked =
              await transaction.findRegistrationForUpdate(
                value.id,
              );

            secondCompleted = true;

            expect(locked).toMatchObject({
              id: value.id,
              status: "APPROVED",
              provisionedTenantId: tenantId,
            });

            return "second";
          },
        );

        await secondStarted;

        let waitingLocks = 0;

        for (let attempt = 0; attempt < 50; attempt += 1) {
          const waiting = await ownerPool.query<{
            count: number;
          }>(
            `SELECT count(*)::int AS count
               FROM pg_locks
              WHERE locktype = 'advisory'
                AND NOT granted`,
          );

          waitingLocks = waiting.rows[0]?.count ?? 0;

          if (waitingLocks > 0) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 10),
          );
        }

        expect(waitingLocks).toBeGreaterThan(0);
        expect(secondCompleted).toBe(false);

        releaseFirst();

        await expect(first).resolves.toBe("first");
        await expect(second).resolves.toBe("second");

        expect(secondCompleted).toBe(true);
      },
    );

    it(
      "atomically links the persisted identity and consumes the bootstrap token",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();

        await ownerPool.query(
          `UPDATE agency_onboarding.agency_registrations
              SET status = 'APPROVED',
                  provisioned_tenant_id = $2,
                  reviewed_by_identity_id = $3,
                  review_started_at = $4,
                  approval_provisioning_started_at = $5,
                  approved_at = $6,
                  updated_at = $6
            WHERE registration_id = $1`,
          [
            value.id,
            tenantId,
            randomUUID(),
            "2026-09-18T12:05:00.000Z",
            "2026-09-18T12:10:00.000Z",
            "2026-09-18T12:15:00.000Z",
          ],
        );

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId: randomUUID(),
            invitedEmail: "administrator@example.test",
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash: "b".repeat(64),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:15:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt: "2026-09-18T12:15:00.000Z",
          });

        await unitOfWork.execute(async (transaction) => {
          await transaction.insertAdministrator(
            administrator,
          );
        });

        const consumedAt =
          "2026-09-18T12:30:00.000Z";
        const externalIssuer =
          "https://monpiole-dev-ci.eu.auth0.com/";
        const externalSubject =
          "auth0|first-administrator";

        const linked = await unitOfWork.execute(
          async (transaction) => {
            const locked =
              await transaction
                .findAdministratorByBootstrapTokenHashForUpdate(
                  administrator.bootstrapTokenHash,
                );

            expect(locked).toEqual(administrator);

            return transaction.markAdministratorIdentityLinked(
              administrator.bootstrapTokenHash,
              administrator.internalIdentityId,
              externalIssuer,
              externalSubject,
              consumedAt,
              consumedAt,
            );
          },
        );

        expect(linked).toEqual({
          ...administrator,
          status: "IDENTITY_LINKED",
          externalIssuer,
          externalSubject,
          bootstrapTokenConsumedAt: consumedAt,
          identityLinkedAt: consumedAt,
        });

        const replay = await unitOfWork.execute(
          async (transaction) => {
            const locked =
              await transaction
                .findAdministratorByBootstrapTokenHashForUpdate(
                  administrator.bootstrapTokenHash,
                );

            expect(locked).toEqual(linked);

            return transaction.markAdministratorIdentityLinked(
              administrator.bootstrapTokenHash,
              administrator.internalIdentityId,
              externalIssuer,
              externalSubject,
              "2026-09-18T12:31:00.000Z",
              "2026-09-18T12:31:00.000Z",
            );
          },
        );

        expect(replay).toBeUndefined();

        const conflictingIdentity = await unitOfWork.execute(
          async (transaction) => {
            await transaction
              .findAdministratorByBootstrapTokenHashForUpdate(
                administrator.bootstrapTokenHash,
              );

            return transaction.markAdministratorIdentityLinked(
              administrator.bootstrapTokenHash,
              randomUUID(),
              externalIssuer,
              externalSubject,
              "2026-09-18T12:32:00.000Z",
              "2026-09-18T12:32:00.000Z",
            );
          },
        );

        expect(conflictingIdentity).toBeUndefined();

        const persisted = await ownerPool.query<{
          status: string;
          internal_identity_id: string;
          bootstrap_token_consumed_at: Date;
          external_issuer: string;
          external_subject: string;
          identity_linked_at: Date;
        }>(
          `SELECT
             status,
             internal_identity_id,
             bootstrap_token_consumed_at,
             external_issuer,
             external_subject,
             identity_linked_at
           FROM agency_onboarding.agency_registration_administrators
          WHERE registration_id = $1`,
          [value.id],
        );

        expect(persisted.rows).toHaveLength(1);

        expect(persisted.rows[0]).toMatchObject({
          status: "IDENTITY_LINKED",
          internal_identity_id:
            administrator.internalIdentityId,
          external_issuer: externalIssuer,
          external_subject: externalSubject,
        });

        expect(
          persisted.rows[0]?.bootstrap_token_consumed_at
            .toISOString(),
        ).toBe(consumedAt);

        expect(
          persisted.rows[0]?.identity_linked_at
            .toISOString(),
        ).toBe(consumedAt);
      },
    );

    it(
      "serializes concurrent completion lookups for the same bootstrap token",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();

        await ownerPool.query(
          `UPDATE agency_onboarding.agency_registrations
              SET status = 'APPROVED',
                  provisioned_tenant_id = $2,
                  reviewed_by_identity_id = $3,
                  review_started_at = $4,
                  approval_provisioning_started_at = $5,
                  approved_at = $6,
                  updated_at = $6
            WHERE registration_id = $1`,
          [
            value.id,
            tenantId,
            randomUUID(),
            "2026-09-18T12:05:00.000Z",
            "2026-09-18T12:10:00.000Z",
            "2026-09-18T12:15:00.000Z",
          ],
        );

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId: randomUUID(),
            invitedEmail: "administrator@example.test",
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash: "c".repeat(64),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:15:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt: "2026-09-18T12:15:00.000Z",
          });

        await unitOfWork.execute(async (transaction) => {
          await transaction.insertAdministrator(
            administrator,
          );
        });

        let releaseFirst!: () => void;

        const holdFirst = new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });

        let firstHasLock!: () => void;

        const firstLocked = new Promise<void>((resolve) => {
          firstHasLock = resolve;
        });

        const first = unitOfWork.execute(
          async (transaction) => {
            const locked =
              await transaction
                .findAdministratorByBootstrapTokenHashForUpdate(
                  administrator.bootstrapTokenHash,
                );

            expect(locked).toEqual(administrator);

            firstHasLock();

            await holdFirst;

            return "first";
          },
        );

        await firstLocked;

        let secondEntered!: () => void;

        const secondStarted = new Promise<void>((resolve) => {
          secondEntered = resolve;
        });

        let secondCompleted = false;

        const second = unitOfWork.execute(
          async (transaction) => {
            secondEntered();

            const locked =
              await transaction
                .findAdministratorByBootstrapTokenHashForUpdate(
                  administrator.bootstrapTokenHash,
                );

            secondCompleted = true;

            expect(locked).toEqual(administrator);

            return "second";
          },
        );

        await secondStarted;

        let waitingLocks = 0;

        for (let attempt = 0; attempt < 50; attempt += 1) {
          const waiting = await ownerPool.query<{
            count: number;
          }>(
            `SELECT count(*)::int AS count
               FROM pg_locks
              WHERE locktype = 'tuple'
                AND NOT granted`,
          );

          waitingLocks = waiting.rows[0]?.count ?? 0;

          if (waitingLocks > 0) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 10),
          );
        }

        /*
         * PostgreSQL row-lock waits are not guaranteed to be exposed
         * as an ungranted tuple lock in pg_locks on every execution.
         * The observable invariant is that the second transaction
         * cannot pass SELECT ... FOR UPDATE before the first commits.
         */
        expect(secondCompleted).toBe(false);

        releaseFirst();

        await expect(first).resolves.toBe("first");
        await expect(second).resolves.toBe("second");

        expect(secondCompleted).toBe(true);
      },
    );

    it(
      "finalizes an identity-linked first administrator exactly once",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();
        const internalIdentityId = randomUUID();

        const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId,
            invitedEmail: "administrator@example.test",
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash: "d".repeat(64),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:00:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt:
              "2026-09-18T12:10:00.000Z",
          });

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        await unitOfWork.execute(async (transaction) => {
          await transaction.insertAdministrator(
            administrator,
          );
        });

        const identityLinkedAt =
          "2026-09-18T12:15:00.000Z";

        const linked = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorIdentityLinked(
              administrator.bootstrapTokenHash,
              administrator.internalIdentityId,
              "https://monpiole-dev-ci.eu.auth0.com/",
              "auth0|finalization-test",
              identityLinkedAt,
              identityLinkedAt,
            ),
        );

        expect(linked).toMatchObject({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
          status: "IDENTITY_LINKED",
          externalIssuer:
            "https://monpiole-dev-ci.eu.auth0.com/",
          externalSubject:
            "auth0|finalization-test",
          identityLinkedAt,
        });

        const activatedAt =
          "2026-09-18T12:20:00.000Z";

        const finalized = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorActive(
              value.id,
              tenantId,
              internalIdentityId,
              activatedAt,
            ),
        );

        expect(finalized).toMatchObject({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
          status: "ACTIVE",
          activatedAt,
          externalIssuer:
            "https://monpiole-dev-ci.eu.auth0.com/",
          externalSubject:
            "auth0|finalization-test",
          identityLinkedAt,
        });

        const replay = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorActive(
              value.id,
              tenantId,
              internalIdentityId,
              "2026-09-18T12:25:00.000Z",
            ),
        );

        expect(replay).toBeUndefined();

        const persisted = await ownerPool.query<{
          status: string;
          activated_at: Date | null;
          external_issuer: string | null;
          external_subject: string | null;
          identity_linked_at: Date | null;
        }>(
          `SELECT
             status,
             activated_at,
             external_issuer,
             external_subject,
             identity_linked_at
           FROM agency_onboarding.agency_registration_administrators
          WHERE registration_id = $1::uuid`,
          [value.id],
        );

        expect(persisted.rows).toHaveLength(1);
        expect(persisted.rows[0]?.status).toBe("ACTIVE");

        expect(
          persisted.rows[0]?.activated_at?.toISOString(),
        ).toBe(activatedAt);

        expect(persisted.rows[0]?.external_issuer).toBe(
          "https://monpiole-dev-ci.eu.auth0.com/",
        );

        expect(persisted.rows[0]?.external_subject).toBe(
          "auth0|finalization-test",
        );

        expect(
          persisted.rows[0]?.identity_linked_at?.toISOString(),
        ).toBe(identityLinkedAt);
      },
    );
    it(
      "refuses finalization before identity linkage and for mismatched identity coordinates",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          runtimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const tenantId = randomUUID();
        const internalIdentityId = randomUUID();

const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId,
            invitedEmail: "administrator@example.test",
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash: "e".repeat(64),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:00:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt:
              "2026-09-18T12:10:00.000Z",
          });

        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(
            runtimePool,
          );

        await unitOfWork.execute(async (transaction) => {
          await transaction.insertAdministrator(
            administrator,
          );
        });

        const beforeLink = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorActive(
              value.id,
              tenantId,
              internalIdentityId,
              "2026-09-18T12:20:00.000Z",
            ),
        );

        expect(beforeLink).toBeUndefined();

        const wrongTenant = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorActive(
              value.id,
              randomUUID(),
              internalIdentityId,
              "2026-09-18T12:20:00.000Z",
            ),
        );

        expect(wrongTenant).toBeUndefined();

        const wrongIdentity = await unitOfWork.execute(
          (transaction) =>
            transaction.markAdministratorActive(
              value.id,
              tenantId,
              randomUUID(),
              "2026-09-18T12:20:00.000Z",
            ),
        );

        expect(wrongIdentity).toBeUndefined();

        const persisted = await ownerPool.query<{
          status: string;
          activated_at: Date | null;
        }>(
          `SELECT status, activated_at
             FROM agency_onboarding.agency_registration_administrators
            WHERE registration_id = $1::uuid`,
          [value.id],
        );

        expect(persisted.rows).toHaveLength(1);
        expect(persisted.rows[0]?.status).toBe(
          "PENDING_IDENTITY",
        );
        expect(persisted.rows[0]?.activated_at).toBeNull();
      },
    );
    it(
      "rotates only the credential of one pending administrator and invalidates the old hash",
      async () => {
        const value = registration();
        await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
          registration: value,
          documents: [],
        });
        const tenantId = randomUUID();
        const internalIdentityId = randomUUID();
        const oldHash = "f".repeat(64);
        const newHash = "1".repeat(64);
        const newExpiration = "2026-09-20T12:00:00.000Z";
        const administrator: FirstAdministratorBootstrap = Object.freeze({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
          invitedEmail: "administrator@example.test",
          administratorKind: "FIRST_ADMINISTRATOR",
          status: "PENDING_IDENTITY",
          bootstrapTokenHash: oldHash,
          bootstrapTokenExpiresAt: "2026-09-19T12:00:00.000Z",
          createdByPlatformIdentityId: randomUUID(),
          createdAt: "2026-09-18T12:10:00.000Z",
        });
        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(runtimePool);

        await unitOfWork.execute((transaction) =>
          transaction.insertAdministrator(administrator));

        await expect(
          new PostgresAgencyRegistrationQueryStore(runtimePool)
            .findFirstAdministrator(value.id),
        ).resolves.toEqual({
          administratorId: internalIdentityId,
          status: "PENDING_IDENTITY",
          bootstrapTokenExpiresAt: "2026-09-19T12:00:00.000Z",
        });

        const rotated = await unitOfWork.execute((transaction) =>
          transaction.rotateAdministratorBootstrapToken(
            value.id,
            tenantId,
            internalIdentityId,
            newHash,
            newExpiration,
          ));

        expect(rotated).toMatchObject({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
          status: "PENDING_IDENTITY",
          bootstrapTokenHash: newHash,
          bootstrapTokenExpiresAt: newExpiration,
        });
        expect(rotated?.bootstrapTokenConsumedAt).toBeUndefined();
        expect(rotated?.identityLinkedAt).toBeUndefined();

        const oldLookup = await unitOfWork.execute((transaction) =>
          transaction.findAdministratorByBootstrapTokenHashForUpdate(oldHash));
        const newLookup = await unitOfWork.execute((transaction) =>
          transaction.findAdministratorByBootstrapTokenHashForUpdate(newHash));

        expect(oldLookup).toBeUndefined();
        expect(newLookup).toMatchObject({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
        });

        const persisted = await ownerPool.query<{
          count: string;
          tenant_id: string;
          internal_identity_id: string;
          status: string;
          bootstrap_token_hash: string;
          bootstrap_token_expires_at: Date;
          bootstrap_token_consumed_at: Date | null;
          identity_linked_at: Date | null;
        }>(
          `SELECT count(*) OVER ()::text AS count,
                  tenant_id, internal_identity_id, status,
                  bootstrap_token_hash, bootstrap_token_expires_at,
                  bootstrap_token_consumed_at, identity_linked_at
             FROM agency_onboarding.agency_registration_administrators
            WHERE registration_id = $1::uuid`,
          [value.id],
        );
        expect(persisted.rows).toHaveLength(1);
        expect(persisted.rows[0]).toMatchObject({
          count: "1",
          tenant_id: tenantId,
          internal_identity_id: internalIdentityId,
          status: "PENDING_IDENTITY",
          bootstrap_token_hash: newHash,
          bootstrap_token_consumed_at: null,
          identity_linked_at: null,
        });
        expect(persisted.rows[0]?.bootstrap_token_expires_at.toISOString())
          .toBe(newExpiration);
      },
    );

    it(
      "refuses a stale rotation after concurrent identity linkage",
      async () => {
        const value = registration();
        await new PostgresSubmitAgencyRegistrationStore(runtimePool).submit({
          registration: value,
          documents: [],
        });
        const tenantId = randomUUID();
        const internalIdentityId = randomUUID();
        const oldHash = "2".repeat(64);
        const administrator: FirstAdministratorBootstrap = Object.freeze({
          registrationId: value.id,
          tenantId,
          internalIdentityId,
          invitedEmail: "administrator@example.test",
          administratorKind: "FIRST_ADMINISTRATOR",
          status: "PENDING_IDENTITY",
          bootstrapTokenHash: oldHash,
          bootstrapTokenExpiresAt: "2026-09-19T12:00:00.000Z",
          createdByPlatformIdentityId: randomUUID(),
          createdAt: "2026-09-18T12:10:00.000Z",
        });
        const unitOfWork =
          new PostgresFirstAdministratorBootstrapUnitOfWork(runtimePool);
        await unitOfWork.execute((transaction) =>
          transaction.insertAdministrator(administrator));

        let releaseRotation: (() => void) | undefined;
        const linkageMayProceed = new Promise<void>((resolve) => {
          releaseRotation = resolve;
        });
        let staleReadReached: (() => void) | undefined;
        const staleRead = new Promise<void>((resolve) => {
          staleReadReached = resolve;
        });

        const rotation = unitOfWork.execute(async (transaction) => {
          const observed =
            await transaction.findAdministratorByRegistration(value.id);
          expect(observed?.status).toBe("PENDING_IDENTITY");
          staleReadReached?.();
          await linkageMayProceed;
          return transaction.rotateAdministratorBootstrapToken(
            value.id,
            tenantId,
            internalIdentityId,
            "3".repeat(64),
            "2026-09-20T12:00:00.000Z",
          );
        });

        await staleRead;
        const linkedAt = "2026-09-18T12:30:00.000Z";
        const linked = await unitOfWork.execute((transaction) =>
          transaction.markAdministratorIdentityLinked(
            oldHash,
            internalIdentityId,
            "https://issuer.example/",
            "auth0|concurrent-link",
            linkedAt,
            linkedAt,
          ));
        expect(linked?.status).toBe("IDENTITY_LINKED");
        releaseRotation?.();

        await expect(rotation).resolves.toBeUndefined();
        const persisted = await unitOfWork.execute((transaction) =>
          transaction.findAdministratorByRegistration(value.id));
        expect(persisted).toMatchObject({
          status: "IDENTITY_LINKED",
          bootstrapTokenHash: oldHash,
          bootstrapTokenConsumedAt: linkedAt,
          identityLinkedAt: linkedAt,
        });
      },
    );
  },
);
