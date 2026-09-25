import { createHash, randomUUID } from "node:crypto";
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
  CompleteFirstAdministratorIdentity,
  FirstAdministratorIdentityLinkConflictError,
  PostgresFirstAdministratorBootstrapUnitOfWork,
  PostgresSubmitAgencyRegistrationStore,
  type AgencyRegistration,
  type FirstAdministratorBootstrap,
  type FirstAdministratorExternalIdentityLinkPort,
} from "../src/index.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";

const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-agency-runtime-password";

const BOOTSTRAP_TOKEN =
  "synthetic-concurrent-first-administrator-bootstrap-token";

const NOW = "2026-09-18T12:30:00.000Z";

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
    "/first_admin_completion_test"
  );
}

function registration(): AgencyRegistration {
  const now = "2026-09-18T12:00:00.000Z";

  return Object.freeze({
    id: randomUUID(),
    status: "SUBMITTED",
    agencyLegalName: "Agence Completion CI",
    agencyTradeName: "Completion Immobilier",
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
    contactEmail: `contact-${randomUUID()}@example.invalid`,
    contactPhone: "+2250506070809",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    correlationId: randomUUID(),
  });
}

function hashBootstrapToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "first_admin_completion_test",
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

const INVITED_EMAIL = "administrator@example.com";

describe(
  "CompleteFirstAdministratorIdentity PostgreSQL concurrency",
  () => {
    it(
      "keeps the bootstrap locked through Identity linking and prevents a second external association",
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

        const administrator: FirstAdministratorBootstrap =
          Object.freeze({
            registrationId: value.id,
            tenantId,
            internalIdentityId,
            invitedEmail: INVITED_EMAIL,
            administratorKind: "FIRST_ADMINISTRATOR",
            status: "PENDING_IDENTITY",
            bootstrapTokenHash:
              hashBootstrapToken(BOOTSTRAP_TOKEN),
            bootstrapTokenExpiresAt:
              "2026-09-18T13:15:00.000Z",
            createdByPlatformIdentityId: randomUUID(),
            createdAt: "2026-09-18T12:15:00.000Z",
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

        let releaseFirstIdentity!: () => void;

        const holdFirstIdentity = new Promise<void>(
          (resolve) => {
            releaseFirstIdentity = resolve;
          },
        );

        let firstIdentityEntered!: () => void;

        const firstIdentityStarted = new Promise<void>(
          (resolve) => {
            firstIdentityEntered = resolve;
          },
        );

        let firstLinkCalls = 0;

        const firstIdentityPort:
          FirstAdministratorExternalIdentityLinkPort = {
            canonicalize(input) {
              return {
                issuer: new URL(input.issuer).toString(),
                subject: input.subject.trim(),
              };
            },

            async link(input) {
              firstLinkCalls += 1;

              expect(input).toMatchObject({
                subject: "auth0|first-concurrent-subject",
                internalIdentityId,
                tenantId,
              });

              firstIdentityEntered();

              await holdFirstIdentity;

              return {
                issuer: new URL(input.issuer).toString(),
                subject: input.subject.trim(),
              };
            },
          };

        let secondCanonicalizeCalls = 0;
        let secondLinkCalls = 0;

        const secondIdentityPort:
          FirstAdministratorExternalIdentityLinkPort = {
            canonicalize(input) {
              secondCanonicalizeCalls += 1;

              return {
                issuer: new URL(input.issuer).toString(),
                subject: input.subject.trim(),
              };
            },

            async link(input) {
              secondLinkCalls += 1;

              return {
                issuer: new URL(input.issuer).toString(),
                subject: input.subject.trim(),
              };
            },
          };

        const tokenHasher = {
          hash(token: string) {
            return hashBootstrapToken(token);
          },
        };

        const clock = {
          now() {
            return NOW;
          },
        };

        const firstUseCase =
          new CompleteFirstAdministratorIdentity(
            unitOfWork,
            tokenHasher,
            clock,
            firstIdentityPort,
          );

        const secondUseCase =
          new CompleteFirstAdministratorIdentity(
            unitOfWork,
            tokenHasher,
            clock,
            secondIdentityPort,
          );

        const first = firstUseCase.execute({
          bootstrapToken: BOOTSTRAP_TOKEN,
          issuer:
            "https://monpiole-dev-ci.eu.auth0.com/",
          subject: "auth0|first-concurrent-subject",
          email: INVITED_EMAIL,
          emailVerified: true,
        });

        await firstIdentityStarted;

        const second = secondUseCase.execute({
          bootstrapToken: BOOTSTRAP_TOKEN,
          issuer:
            "https://monpiole-dev-ci.eu.auth0.com/",
          subject: "auth0|different-concurrent-subject",
          email: INVITED_EMAIL,
          emailVerified: true,
        });

        /*
         * Wait until PostgreSQL exposes the second transaction as
         * waiting, or until enough scheduling opportunities have
         * elapsed to establish the observable invariant below.
         */
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const waiting = await ownerPool.query<{
            count: number;
          }>(
            `SELECT count(*)::int AS count
               FROM pg_locks
              WHERE locktype = 'tuple'
                AND NOT granted`,
          );

          if ((waiting.rows[0]?.count ?? 0) > 0) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 10),
          );
        }

        /*
         * The first use case is blocked inside Identity while still
         * owning SELECT ... FOR UPDATE.
         *
         * Therefore the second use case must not reach its Identity
         * adapter, even though it uses a different Auth0 subject.
         */
        expect(firstLinkCalls).toBe(1);
        expect(secondCanonicalizeCalls).toBe(0);
        expect(secondLinkCalls).toBe(0);

        releaseFirstIdentity();

        const firstResult = await first;

        await expect(second).rejects.toBeInstanceOf(
          FirstAdministratorIdentityLinkConflictError,
        );

        expect(firstResult).toMatchObject({
          registrationId: value.id,
          tenantId,
          administratorId: internalIdentityId,
          role: "TENANT_ADMINISTRATOR",
          status: "IDENTITY_LINKED",
          identityLinkedAt: NOW,
        });

        /*
         * Once the first transaction commits, the second transaction
         * acquires the row lock and observes the canonical provenance
         * persisted by the first completion.
         *
         * Its different Auth0 subject is rejected without creating a
         * second external association.
         */
        expect(firstLinkCalls).toBe(1);
        expect(secondCanonicalizeCalls).toBe(1);
        expect(secondLinkCalls).toBe(0);

        const persisted = await ownerPool.query<{
          status: string;
          internal_identity_id: string;
          external_issuer: string;
          external_subject: string;
          bootstrap_token_consumed_at: Date;
          identity_linked_at: Date;
        }>(
          `SELECT
             status,
             internal_identity_id,
             external_issuer,
             external_subject,
             bootstrap_token_consumed_at,
             identity_linked_at
           FROM agency_onboarding.agency_registration_administrators
          WHERE registration_id = $1`,
          [value.id],
        );

        expect(persisted.rows).toHaveLength(1);

        expect(persisted.rows[0]).toMatchObject({
          status: "IDENTITY_LINKED",
          internal_identity_id: internalIdentityId,
          external_issuer:
            "https://monpiole-dev-ci.eu.auth0.com/",
          external_subject: "auth0|first-concurrent-subject",
        });

        expect(
          persisted.rows[0]?.bootstrap_token_consumed_at
            .toISOString(),
        ).toBe(NOW);

        expect(
          persisted.rows[0]?.identity_linked_at
            .toISOString(),
        ).toBe(NOW);
      },
    );
  },
);
