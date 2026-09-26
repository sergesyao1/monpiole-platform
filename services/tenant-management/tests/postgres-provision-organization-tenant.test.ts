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
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  DuplicateProvisioningTenantEmailError,
  OrganizationTenantProvisioningIdempotencyConflictError,
  ProvisionOrganizationTenant,
} from "../src/application/provision-organization-tenant.js";
import { PostgresProvisionOrganizationTenantUnitOfWork } from "../src/infrastructure/persistence/postgres/provision-organization-tenant-store.js";

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
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/tenant_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "tenant_test",
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

  await ownerPool.query(
    `CREATE ROLE tenant_runtime
     LOGIN PASSWORD '${RUNTIME_PASSWORD}'
     NOSUPERUSER
     NOCREATEDB
     NOCREATEROLE
     NOINHERIT
     NOBYPASSRLS`,
  );

  await migrate(drizzle(ownerPool), {
    migrationsFolder,
  });

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA tenant_management TO tenant_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO tenant_runtime",
  );

  runtimePool = new Pool({
    connectionString: connectionString(
      "tenant_runtime",
      RUNTIME_PASSWORD,
    ),
    max: 4,
  });
});

afterEach(async () => {
  await ownerPool.query(`
    TRUNCATE
      tenant_management.outbox,
      tenant_management.organization_tenant_provisioning_idempotency,
      tenant_management.organizations,
      tenant_management.create_tenant_idempotency,
      tenant_management.tenants
    CASCADE
  `);
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

function command(
  key: string,
  email = "owner@example.invalid",
  legalName = "MonPiole Gestion CI",
) {
  return {
    authority: {
      actorId: "actor-1",
      authorityId: "platform-admin",
      grants: ["CREATE_TENANT"] as const,
      tenantIds: [],
    },
    correlationId:
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    idempotencyKey: key,

    tenant: {
      organizationName: legalName,
      responsiblePersonName: "Ada Example",
      responsibleEmail: email,
      responsibleTelephone: "+2250102030405",
      country: "CI",
    },

    organization: {
      type: "PROPERTY_MANAGEMENT_COMPANY" as const,
      legalName,
      tradeName: "MonPiole Gestion",
      registrationNumber: `CI-ABJ-${key}`,
      taxIdentifier: "CC-1234567",
      phone: "+2250102030405",
      email,
      website: "https://example.invalid",
      address: "Cocody",
      city: "Abidjan",
      countryCode: "CI",
      defaultLanguageCode: "fr",
      defaultLocale: "fr-CI",
      defaultCurrencyCode: "XOF",
      defaultTimezone: "Africa/Abidjan",
    },
  };
}

function createUseCase(
  eventId: () => string = () => randomUUID(),
) {
  return new ProvisionOrganizationTenant(
    {
      authorizeCreateTenant: async () => true,
    },
    new PostgresProvisionOrganizationTenantUnitOfWork(
      runtimePool,
    ),
    {
      generate: () => randomUUID(),
    },
    {
      generate: () => randomUUID(),
    },
    {
      generate: eventId,
    },
    {
      now: () => "2026-09-26T10:00:00.000Z",
    },
  );
}

async function counts() {
  const result = await ownerPool.query<{
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
      )::text AS outbox
  `);

  return result.rows[0];
}

const oneCompositeProvisioning = {
  tenants: "1",
  organizations: "1",
  idempotency: "1",
  outbox: "1",
};

const noCompositeProvisioning = {
  tenants: "0",
  organizations: "0",
  idempotency: "0",
  outbox: "0",
};

describe(
  "Provision Organization Tenant PostgreSQL adapter",
  () => {
    it(
      "atomically creates tenant, organization, idempotency, and Outbox records",
      async () => {
        const input = command("composite-create");

        const result =
          await createUseCase().execute(input);

        expect(result.lifecycleState).toBe("PENDING");
        expect(result.tenantId).not.toBe(
          result.organizationId,
        );

        expect(await counts()).toEqual(
          oneCompositeProvisioning,
        );

        const organization =
          await ownerPool.query<{
            tenant_id: string;
            organization_type: string;
            legal_name: string;
            default_language_code: string;
            default_locale: string;
            default_currency_code: string;
            default_timezone: string;
          }>(
            `SELECT
               tenant_id,
               organization_type,
               legal_name,
               default_language_code,
               default_locale,
               default_currency_code,
               default_timezone
             FROM tenant_management.organizations
             WHERE id = $1`,
            [result.organizationId],
          );

        expect(organization.rows[0]).toEqual({
          tenant_id: result.tenantId,
          organization_type:
            "PROPERTY_MANAGEMENT_COMPANY",
          legal_name: input.organization.legalName,
          default_language_code: "fr",
          default_locale: "fr-CI",
          default_currency_code: "XOF",
          default_timezone: "Africa/Abidjan",
        });

        const outbox =
          await ownerPool.query<{
            event_type: string;
            envelope: Record<string, unknown>;
          }>(
            `SELECT event_type, envelope
             FROM tenant_management.outbox`,
          );

        expect(outbox.rows).toHaveLength(1);

        expect(outbox.rows[0]).toMatchObject({
          event_type:
            "monpiole.tenant.tenant-created",
        });

        expect(
          outbox.rows[0]?.envelope,
        ).toMatchObject({
          eventType:
            "monpiole.tenant.tenant-created",
          tenantId: result.tenantId,
          correlationId: input.correlationId,
          payload: {
            tenantId: result.tenantId,
            lifecycleState: "PENDING",
          },
        });
      },
    );

    it(
      "returns the persisted composite result without duplicate rows on replay",
      async () => {
        const useCase = createUseCase();
        const input = command("composite-replay");

        const first =
          await useCase.execute(input);

        await expect(
          useCase.execute(input),
        ).resolves.toEqual(first);

        expect(await counts()).toEqual(
          oneCompositeProvisioning,
        );
      },
    );

    it(
      "rejects a different composite intent under the same key",
      async () => {
        const useCase = createUseCase();

        await useCase.execute(
          command("composite-conflict"),
        );

        await expect(
          useCase.execute(
            command(
              "composite-conflict",
              "other@example.invalid",
            ),
          ),
        ).rejects.toBeInstanceOf(
          OrganizationTenantProvisioningIdempotencyConflictError,
        );

        expect(await counts()).toEqual(
          oneCompositeProvisioning,
        );
      },
    );

    it(
      "serializes concurrent use of the same composite idempotency key",
      async () => {
        const useCase = createUseCase();
        const input = command("composite-same-key");

        const [first, second] =
          await Promise.all([
            useCase.execute(input),
            useCase.execute(input),
          ]);

        expect(second).toEqual(first);

        expect(await counts()).toEqual(
          oneCompositeProvisioning,
        );
      },
    );

    it(
      "uses tenant email uniqueness as concurrent duplicate protection",
      async () => {
        const useCase = createUseCase();

        const settled =
          await Promise.allSettled([
            useCase.execute(
              command(
                "composite-email-a",
                "duplicate@example.invalid",
                "Organization A",
              ),
            ),
            useCase.execute(
              command(
                "composite-email-b",
                "duplicate@example.invalid",
                "Organization B",
              ),
            ),
          ]);

        expect(
          settled.filter(
            (item) => item.status === "fulfilled",
          ),
        ).toHaveLength(1);

        const rejected = settled.find(
          (item) => item.status === "rejected",
        ) as PromiseRejectedResult;

        expect(rejected.reason).toBeInstanceOf(
          DuplicateProvisioningTenantEmailError,
        );

        expect(await counts()).toEqual(
          oneCompositeProvisioning,
        );
      },
    );

    it(
      "rolls back tenant, organization, idempotency, and Outbox when Outbox contract creation fails",
      async () => {
        await expect(
          createUseCase(
            () => "not-an-event-id",
          ).execute(
            command("composite-rollback"),
          ),
        ).rejects.toThrow();

        expect(await counts()).toEqual(
          noCompositeProvisioning,
        );
      },
    );
  },
);
