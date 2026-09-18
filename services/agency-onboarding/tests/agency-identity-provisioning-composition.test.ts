import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  BootstrapTenantAdministrator,
  PostgresIdentityStore,
  type IdentityOnboardingAuthorizer,
} from "../../identity/src/index.js";
import {
  CheckTenantExists,
  CreateTenant,
  PostgresCreateTenantUnitOfWork,
  PostgresTenantExistenceRepository,
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
  AgencyIdentityProvisioningAdapter,
} from "../../../apps/api/src/composition/agency-identity-provisioning.adapter.js";
import {
  TenantExistenceAdapter,
} from "../../../apps/api/src/composition/tenant-existence.adapter.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";

const OWNER_PASSWORD = "synthetic-owner-password";
const IDENTITY_RUNTIME_PASSWORD =
  "synthetic-identity-runtime-password";
const TENANT_RUNTIME_PASSWORD =
  "synthetic-tenant-runtime-password";

const identityMigrationsFolder = fileURLToPath(
  new URL(
    "../../identity/migrations",
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
let identityRuntimePool: Pool;
let tenantRuntimePool: Pool;

function connectionString(
  user: string,
  password: string,
): string {
  return (
    `postgresql://${user}:${password}` +
    `@${container.getHost()}` +
    `:${container.getMappedPort(5432)}` +
    "/agency_identity_composition_test"
  );
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "agency_identity_composition_test",
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
    CREATE ROLE identity_runtime
      LOGIN
      PASSWORD '${IDENTITY_RUNTIME_PASSWORD}'
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
    migrationsFolder: tenantMigrationsFolder,
    migrationsTable:
      "__drizzle_migrations_tenant_management",
    migrationsSchema: "drizzle",
  });

  await migrate(drizzle(ownerPool), {
    migrationsFolder: identityMigrationsFolder,
    migrationsTable:
      "__drizzle_migrations_identity",
    migrationsSchema: "drizzle",
  });

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA tenant_management TO tenant_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tenant_management TO tenant_runtime",
  );

  await ownerPool.query(
    "GRANT USAGE ON SCHEMA identity TO identity_runtime",
  );

  await ownerPool.query(
    "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO identity_runtime",
  );

  tenantRuntimePool = new Pool({
    connectionString: connectionString(
      "tenant_runtime",
      TENANT_RUNTIME_PASSWORD,
    ),
    max: 4,
  });

  identityRuntimePool = new Pool({
    connectionString: connectionString(
      "identity_runtime",
      IDENTITY_RUNTIME_PASSWORD,
    ),
    max: 4,
  });
});

afterAll(async () => {
  await identityRuntimePool?.end();
  await tenantRuntimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

describe(
  "Agency registration to identity provisioning composition",
  () => {
    it(
      "converges to one tenant administrator and preserves tenant-scoped authority",
      async () => {
        const tenantId = randomUUID();
        const administratorId = randomUUID();
        const correlationId = randomUUID();
        const platformIdentityId = randomUUID();

        const createTenant = new CreateTenant(
          {
            authorizeCreateTenant: async (
              authority,
            ) =>
              authority.authorityId ===
                "system:test-agency-provisioning" &&
              authority.grants.includes(
                "CREATE_TENANT",
              ),
          },
          new PostgresCreateTenantUnitOfWork(
            tenantRuntimePool,
          ),
          {
            generate: () => tenantId,
          },
          {
            generate: () => randomUUID(),
          },
          {
            now: () =>
              "2026-09-18T15:00:00.000Z",
          },
        );

        await createTenant.execute({
          organizationName:
            "Agence Identity Composition",
          responsiblePersonName:
            "Awa Kone",
          responsibleEmail:
            "responsable@example.invalid",
          responsibleTelephone:
            "+2250700000000",
          country:
            "CI",
          authority: {
            actorId: platformIdentityId,
            authorityId:
              "system:test-agency-provisioning",
            grants: ["CREATE_TENANT"],
          },
          correlationId,
          idempotencyKey:
            `agency-identity-test:${tenantId}`,
        });

        const tenantExists = new CheckTenantExists(
          new PostgresTenantExistenceRepository(
            tenantRuntimePool,
          ),
        );

        const observedAuthorities: Array<{
          actorId: string;
          authorityId: string;
          grants: readonly string[];
          tenantIds: readonly string[];
          requestedTenantId: string;
        }> = [];

        const authorizer:
          IdentityOnboardingAuthorizer = {
            async authorize(
              authority,
              grant,
              requestedTenantId,
            ) {
              observedAuthorities.push({
                actorId: authority.actorId,
                authorityId:
                  authority.authorityId,
                grants: [...authority.grants],
                tenantIds:
                  [...authority.tenantIds],
                requestedTenantId,
              });

              return (
                authority.authorityId ===
                  "system:agency-identity-provisioning" &&
                authority.actorId ===
                  platformIdentityId &&
                authority.grants.includes(grant) &&
                authority.tenantIds.includes(
                  requestedTenantId,
                )
              );
            },
          };

        const bootstrap =
          new BootstrapTenantAdministrator(
            new TenantExistenceAdapter(
              tenantExists,
            ),
            new PostgresIdentityStore(
              identityRuntimePool,
            ),
            {
              generate: () => administratorId,
            },
            authorizer,
          );

        const adapter =
          new AgencyIdentityProvisioningAdapter(
            bootstrap,
          );

        const input = {
          registrationId: randomUUID(),
          tenantId,
          email: "Admin.Agency@Example.com",
          firstName: "Awa",
          lastName: "Kone",
          correlationId,
          requestedByPlatformIdentityId:
            platformIdentityId,
        };

        const first =
          await adapter.provision(input);

        expect(first).toEqual({
          tenantId,
          administratorId,
          email: "admin.agency@example.com",
          role: "TENANT_ADMINISTRATOR",
          status: "PENDING_ACTIVATION",
        });

        /*
         * Simulates a caller crash after Identity committed
         * successfully but before agency-onboarding persisted
         * its own administrator bootstrap state.
         *
         * A retry therefore invokes the adapter again with the
         * exact same provisioning correlation.
         */
        const replay =
          await adapter.provision(input);

        expect(replay).toEqual(first);

        expect(observedAuthorities).toHaveLength(2);

        for (const authority of observedAuthorities) {
          expect(authority).toEqual({
            actorId: platformIdentityId,
            authorityId:
              "system:agency-identity-provisioning",
            grants: [
              "BOOTSTRAP_TENANT_ADMINISTRATOR",
            ],
            tenantIds: [tenantId],
            requestedTenantId: tenantId,
          });
        }

        const identities =
          await ownerPool.query<{
            tenant_id: string;
            id: string;
            email: string;
            status: string;
            correlation_id: string;
          }>(`
            SELECT
              tenant_id,
              id,
              email,
              status,
              correlation_id
            FROM identity.identities
          `);

        expect(identities.rows).toEqual([
          {
            tenant_id: tenantId,
            id: administratorId,
            email: "admin.agency@example.com",
            status: "PENDING_ACTIVATION",
            correlation_id: correlationId,
          },
        ]);

        const memberships =
          await ownerPool.query<{
            tenant_id: string;
            identity_id: string;
            role: string;
            correlation_id: string;
          }>(`
            SELECT
              tenant_id,
              identity_id,
              role,
              correlation_id
            FROM identity.tenant_memberships
          `);

        expect(memberships.rows).toEqual([
          {
            tenant_id: tenantId,
            identity_id: administratorId,
            role: "TENANT_ADMINISTRATOR",
            correlation_id: correlationId,
          },
        ]);

        expect(
          (
            await ownerPool.query(
              `
                SELECT count(*)::text AS count
                FROM identity.identities
              `,
            )
          ).rows[0]?.count,
        ).toBe("1");

        expect(
          (
            await ownerPool.query(
              `
                SELECT count(*)::text AS count
                FROM identity.tenant_memberships
              `,
            )
          ).rows[0]?.count,
        ).toBe("1");
      },
    );
  },
);