import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  ApproveAgencyRegistration,
  PostgresAgencyRegistrationQueryStore,
  PostgresAgencyRegistrationReviewUnitOfWork,
  PostgresSubmitAgencyRegistrationStore,
  StartAgencyRegistrationReview,
  type AgencyRegistration,
  type AgencyTenantProvisioningPort,
} from "../src/index.js";
import {
  PostgresProvisionOrganizationTenantUnitOfWork,
  ProvisionOrganizationTenant,
} from "../../tenant-management/src/index.js";
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
  AgencyTenantProvisioningAdapter,
} from "../../../apps/api/src/composition/agency-tenant-provisioning.adapter.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";

const OWNER_PASSWORD = "synthetic-owner-password";
const AGENCY_RUNTIME_PASSWORD =
  "synthetic-agency-runtime-password";
const TENANT_RUNTIME_PASSWORD =
  "synthetic-tenant-runtime-password";

const agencyMigrationsFolder = fileURLToPath(
  new URL(
    "../migrations",
    import.meta.url,
  ),
);

const tenantMigrationsFolder = fileURLToPath(
  new URL(
    "../../tenant-management/migrations",
    import.meta.url,
  ),
);

let container: StartedTestContainer;
let ownerPool: Pool;
let agencyRuntimePool: Pool;
let tenantRuntimePool: Pool;

function connectionString(
  user: string,
  password: string,
): string {
  return (
    `postgresql://${user}:${password}` +
    `@${container.getHost()}` +
    `:${container.getMappedPort(5432)}` +
    "/agency_tenant_composition_test"
  );
}

function registration(): AgencyRegistration {
  const now = "2026-09-16T12:00:00.000Z";

  return Object.freeze({
    id: randomUUID(),
    status: "SUBMITTED",
    agencyLegalName: "Agence Résilience CI",
    agencyTradeName: "Résilience Immobilier",
    registrationNumber: `CI-ABJ-${randomUUID()}`,
    taxIdentifier: `TAX-${randomUUID()}`,
    phone: "+2250102030405",
    email:
      `agency-${randomUUID()}@example.invalid`,
    website: "https://example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    contactFirstName: "Awa",
    contactLastName: "Koné",
    contactEmail:
      `contact-${randomUUID()}@example.invalid`,
    contactPhone: "0506070809",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    correlationId: randomUUID(),
  });
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "agency_tenant_composition_test",
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
      PASSWORD '${AGENCY_RUNTIME_PASSWORD}'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS
  `);

  await ownerPool.query(`
    CREATE ROLE tenant_runtime
      LOGIN
      PASSWORD '${TENANT_RUNTIME_PASSWORD}'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS
  `);

  await migrate(drizzle(ownerPool), {
    migrationsFolder: agencyMigrationsFolder,
    migrationsTable:
      "__drizzle_migrations_agency_onboarding",
    migrationsSchema: "drizzle",
  });

  await migrate(drizzle(ownerPool), {
    migrationsFolder: tenantMigrationsFolder,
    migrationsTable:
      "__drizzle_migrations_tenant_management",
    migrationsSchema: "drizzle",
  });

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA agency_onboarding TO monpiole_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA agency_onboarding TO monpiole_runtime",
  );

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA tenant_management TO tenant_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO tenant_runtime",
  );

  agencyRuntimePool = new Pool({
    connectionString: connectionString(
      "monpiole_runtime",
      AGENCY_RUNTIME_PASSWORD,
    ),
    max: 4,
  });

  tenantRuntimePool = new Pool({
    connectionString: connectionString(
      "tenant_runtime",
      TENANT_RUNTIME_PASSWORD,
    ),
    max: 4,
  });
});

afterAll(async () => {
  await agencyRuntimePool?.end();
  await tenantRuntimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

describe(
  "Agency registration to tenant provisioning composition",
  () => {
    it(
      "converges to one pending tenant and organization after a post-provisioning crash",
      async () => {
        const value = registration();

        await new PostgresSubmitAgencyRegistrationStore(
          agencyRuntimePool,
        ).submit({
          registration: value,
          documents: [],
        });

        const agencyUnitOfWork =
          new PostgresAgencyRegistrationReviewUnitOfWork(
            agencyRuntimePool,
          );

        const reviewerA = randomUUID();

        await new StartAgencyRegistrationReview(
          agencyUnitOfWork,
          {
            now: () =>
              "2026-09-16T12:10:00.000Z",
          },
        ).execute({
          authority: {
            actorId: reviewerA,
            authorityId: randomUUID(),
            grants: [
              "REVIEW_AGENCY_REGISTRATIONS",
            ],
          },
          registrationId: value.id,
        });

        const provisionOrganizationTenant =
          new ProvisionOrganizationTenant(
            {
              authorizeCreateTenant: async (
                authority,
              ) =>
                authority.authorityId ===
                  "system:agency-tenant-provisioning" &&
                authority.grants.includes(
                  "CREATE_TENANT",
                ),
            },
            new PostgresProvisionOrganizationTenantUnitOfWork(
              tenantRuntimePool,
            ),
            {
              generate: () => randomUUID(),
            },
            {
              generate: () => randomUUID(),
            },
            {
              generate: () => randomUUID(),
            },
            {
              now: () =>
                "2026-09-16T12:20:00.000Z",
            },
          );

        const realProvisioning =
          new AgencyTenantProvisioningAdapter(
            provisionOrganizationTenant,
            {
              execute: async () => ({
                defaultLanguageCode: "fr",
                defaultLocale: "fr-CI",
                defaultCurrencyCode: "XOF",
                defaultTimezone: "Africa/Abidjan",
              }),
            },
          );

        let simulateCrash = true;

        const crashAfterSuccessfulProvisioning:
          AgencyTenantProvisioningPort = {
            async provision(input) {
              const result =
                await realProvisioning.provision(
                  input,
                );

              if (simulateCrash) {
                simulateCrash = false;

                throw new Error(
                  "Simulated crash after committed organization tenant provisioning",
                );
              }

              return result;
            },
          };

        const reviewerAAuthority = {
          actorId: reviewerA,
          authorityId: randomUUID(),
          grants: [
            "DECIDE_AGENCY_REGISTRATIONS",
          ] as const,
        };

        const reviewerBAuthority = {
          actorId: randomUUID(),
          authorityId: randomUUID(),
          grants: [
            "DECIDE_AGENCY_REGISTRATIONS",
          ] as const,
        };

        const approval =
          new ApproveAgencyRegistration(
            agencyUnitOfWork,
            crashAfterSuccessfulProvisioning,
            {
              now: () =>
                "2026-09-16T12:30:00.000Z",
            },
          );

        await expect(
          approval.execute({
            authority: reviewerAAuthority,
            registrationId: value.id,
          }),
        ).rejects.toThrow(
          "Simulated crash after committed organization tenant provisioning",
        );

        const afterCrash =
          await new PostgresAgencyRegistrationQueryStore(
            agencyRuntimePool,
          ).findById(value.id);

        expect(afterCrash).toMatchObject({
          status: "UNDER_REVIEW",
          reviewedByIdentityId: reviewerA,
          approvalProvisioningStartedAt:
            "2026-09-16T12:30:00.000Z",
        });

        expect(
          afterCrash?.provisionedTenantId,
        ).toBeUndefined();

        const countsAfterCrash =
          await ownerPool.query<{
            tenants: string;
            organizations: string;
            idempotency: string;
            outbox: string;
          }>(`
            SELECT
              (
                SELECT count(*)
                FROM tenant_management.tenants
              )::text AS tenants,
              (
                SELECT count(*)
                FROM tenant_management.organizations
              )::text AS organizations,
              (
                SELECT count(*)
                FROM tenant_management.organization_tenant_provisioning_idempotency
              )::text AS idempotency,
              (
                SELECT count(*)
                FROM tenant_management.outbox
                WHERE event_type =
                  'monpiole.tenant.tenant-created'
              )::text AS outbox
          `);

        expect(
          countsAfterCrash.rows[0],
        ).toEqual({
          tenants: "1",
          organizations: "1",
          idempotency: "1",
          outbox: "1",
        });

        const approved =
          await approval.execute({
            authority: reviewerBAuthority,
            registrationId: value.id,
          });

        expect(approved).toMatchObject({
          status: "APPROVED",
          reviewedByIdentityId: reviewerA,
          approvalProvisioningStartedAt:
            "2026-09-16T12:30:00.000Z",
        });

        const tenant =
          await ownerPool.query<{
            id: string;
            lifecycle_state: string;
            organization_name: string;
            responsible_email: string;
            responsible_telephone: string;
            actor_id: string;
            authority_id: string;
          }>(`
            SELECT
              id,
              lifecycle_state,
              organization_name,
              responsible_email,
              responsible_telephone,
              actor_id,
              authority_id
            FROM tenant_management.tenants
          `);

        expect(tenant.rows).toHaveLength(1);

        expect(tenant.rows[0]).toMatchObject({
          id: approved.provisionedTenantId,
          lifecycle_state: "PENDING",
          organization_name:
            value.agencyLegalName,
          responsible_email:
            value.contactEmail.toLowerCase(),
            responsible_telephone:
              "+2250506070809",
          actor_id:
            "system:agency-tenant-provisioning",
          authority_id:
            "system:agency-tenant-provisioning",
        });

        const organization =
          await ownerPool.query<{
            id: string;
            tenant_id: string;
            organization_type: string;
            legal_name: string;
            trade_name: string | null;
            registration_number: string;
            tax_identifier: string | null;
            phone: string;
            email: string;
            website: string | null;
            address: string;
            city: string;
            country_code: string;
          }>(`
            SELECT
              id,
              tenant_id,
              organization_type,
              legal_name,
              trade_name,
              registration_number,
              tax_identifier,
              phone,
              email,
              website,
              address,
              city,
              country_code
            FROM tenant_management.organizations
          `);

        expect(organization.rows).toHaveLength(1);

        expect(organization.rows[0]).toMatchObject({
          tenant_id:
            approved.provisionedTenantId,
          organization_type: "REAL_ESTATE_AGENCY",
          legal_name:
            value.agencyLegalName,
          trade_name:
            value.agencyTradeName,
          registration_number:
            value.registrationNumber,
          tax_identifier:
            value.taxIdentifier,
          phone:
            value.phone,
          email:
            value.email.toLowerCase(),
          website:
            value.website,
          address:
            value.address,
          city:
            value.city,
          country_code:
            value.countryCode.toUpperCase(),
        });

        const idempotency =
          await ownerPool.query<{
            authority_id: string;
            idempotency_key: string;
            tenant_id: string;
            organization_id: string;
          }>(`
            SELECT
              authority_id,
              idempotency_key,
              tenant_id,
              organization_id
            FROM tenant_management.organization_tenant_provisioning_idempotency
          `);

        expect(idempotency.rows).toHaveLength(1);

        expect(idempotency.rows[0]).toMatchObject({
          authority_id:
            "system:agency-tenant-provisioning",
          idempotency_key:
            `agency-registration:${value.id}`,
          tenant_id:
            approved.provisionedTenantId,
        });

        const finalCounts =
          await ownerPool.query<{
            tenants: string;
            organizations: string;
            idempotency: string;
            outbox: string;
          }>(`
            SELECT
              (
                SELECT count(*)
                FROM tenant_management.tenants
              )::text AS tenants,
              (
                SELECT count(*)
                FROM tenant_management.organizations
              )::text AS organizations,
              (
                SELECT count(*)
                FROM tenant_management.organization_tenant_provisioning_idempotency
              )::text AS idempotency,
              (
                SELECT count(*)
                FROM tenant_management.outbox
                WHERE event_type =
                  'monpiole.tenant.tenant-created'
              )::text AS outbox
          `);

        expect(finalCounts.rows[0]).toEqual({
          tenants: "1",
          organizations: "1",
          idempotency: "1",
          outbox: "1",
        });

        const persistedRegistration =
          await new PostgresAgencyRegistrationQueryStore(
            agencyRuntimePool,
          ).findById(value.id);

        expect(
          persistedRegistration,
        ).toMatchObject({
          status: "APPROVED",
          provisionedTenantId:
            tenant.rows[0]?.id,
          reviewedByIdentityId: reviewerA,
          approvalProvisioningStartedAt:
            "2026-09-16T12:30:00.000Z",
        });
      },
    );
  },
);
