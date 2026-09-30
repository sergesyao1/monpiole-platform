import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
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
  return (
    `postgresql://${user}:${password}` +
    `@${container.getHost()}` +
    `:${container.getMappedPort(5432)}` +
    "/organization_tenant_provisioning_idempotency_test"
  );
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB:
        "organization_tenant_provisioning_idempotency_test",
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
    CREATE ROLE tenant_runtime
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
      tenant_management.create_tenant_idempotency,
      tenant_management.organization_tenant_provisioning_idempotency,
      tenant_management.organizations,
      tenant_management.tenants
    CASCADE
  `);
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

async function createFoundation(): Promise<{
  tenantId: string;
  organizationId: string;
}> {
  const tenantId = randomUUID();
  const organizationId = randomUUID();

  await ownerPool.query(
    `
      INSERT INTO tenant_management.tenants (
        id,
        organization_name,
        responsible_person_name,
        responsible_email,
        responsible_telephone,
        country,
        lifecycle_state,
        created_at,
        correlation_id,
        actor_id,
        authority_id
      )
      VALUES (
        $1,
        'Composite Provisioning Organization',
        'Ada Example',
        $2,
        '+2250102030405',
        'CI',
        'PENDING',
        '2026-09-26T09:00:00.000Z',
        $3,
        'test-actor',
        'test-authority'
      )
    `,
    [
      tenantId,
      `owner-${randomUUID()}@example.invalid`,
      randomUUID(),
    ],
  );

  await ownerPool.query(
    `
      INSERT INTO tenant_management.organizations (
        id,
        tenant_id,
        organization_type,
        legal_name,
        registration_number,
        phone,
        email,
        address,
        city,
        country_code,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'REAL_ESTATE_AGENCY',
        'Composite Provisioning Organization',
        $3,
        '+2250102030405',
        $4,
        'Abidjan',
        'Abidjan',
        'CI',
        '2026-09-26T09:00:00.000Z',
        '2026-09-26T09:00:00.000Z'
      )
    `,
    [
      organizationId,
      tenantId,
      `CI-ABJ-${randomUUID()}`,
      `organization-${randomUUID()}@example.invalid`,
    ],
  );

  return {
    tenantId,
    organizationId,
  };
}

function idempotencyValues(
  tenantId: string,
  organizationId: string,
): readonly unknown[] {
  return [
    "test-authority",
    `key-${randomUUID()}`,
    JSON.stringify(["normalized", "intent"]),
    tenantId,
    organizationId,
    "PENDING",
    "2026-09-26T09:00:00.000Z",
    randomUUID(),
    "test-actor",
  ];
}

async function insertIdempotency(
  pool: Pool | PoolClient,
  values: readonly unknown[],
): Promise<void> {
  await pool.query(
    `
      INSERT INTO tenant_management.organization_tenant_provisioning_idempotency (
        authority_id,
        idempotency_key,
        normalized_intent,
        tenant_id,
        organization_id,
        lifecycle_state,
        created_at,
        correlation_id,
        actor_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
    `,
    [...values],
  );
}

async function withProvisioningAuthority<Result>(
  operation: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await runtimePool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        SELECT set_config(
          'app.platform_authority',
          'tenant:create',
          true
        )
      `,
    );

    const result = await operation(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe(
  "Organization tenant provisioning idempotency PostgreSQL foundation",
  () => {
    it("applies migration 0004 and exposes the provisioning idempotency table", async () => {
      const result = await ownerPool.query<{
        table_name: string;
      }>(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'tenant_management'
            AND table_name =
              'organization_tenant_provisioning_idempotency'
        `,
      );

      expect(result.rows).toEqual([
        {
          table_name:
            "organization_tenant_provisioning_idempotency",
        },
      ]);
    });

    it("allows authorized insert and read", async () => {
      const {
        tenantId,
        organizationId,
      } = await createFoundation();

      const values = idempotencyValues(
        tenantId,
        organizationId,
      );

      const rows = await withProvisioningAuthority(
        async (client) => {
          await insertIdempotency(client, values);

          return client.query<{
            tenant_id: string;
            organization_id: string;
            lifecycle_state: string;
          }>(
            `
              SELECT
                tenant_id,
                organization_id,
                lifecycle_state
              FROM tenant_management.organization_tenant_provisioning_idempotency
            `,
          );
        },
      );

      expect(rows.rows).toEqual([
        {
          tenant_id: tenantId,
          organization_id: organizationId,
          lifecycle_state: "PENDING",
        },
      ]);
    });

    it("fails closed for insert without tenant:create authority", async () => {
      const {
        tenantId,
        organizationId,
      } = await createFoundation();

      await expect(
        insertIdempotency(
          runtimePool,
          idempotencyValues(
            tenantId,
            organizationId,
          ),
        ),
      ).rejects.toMatchObject({
        code: "42501",
      });
    });

    it("fails closed for reads without tenant:create authority", async () => {
      const {
        tenantId,
        organizationId,
      } = await createFoundation();

      await withProvisioningAuthority(
        async (client) => {
          await insertIdempotency(
            client,
            idempotencyValues(
              tenantId,
              organizationId,
            ),
          );
        },
      );

      const result = await runtimePool.query(
        `
          SELECT *
          FROM tenant_management.organization_tenant_provisioning_idempotency
        `,
      );

      expect(result.rows).toHaveLength(0);
    });

    it("rejects an unknown tenant", async () => {
      const {
        organizationId,
      } = await createFoundation();

      await expect(
        withProvisioningAuthority(
          async (client) => {
            await insertIdempotency(
              client,
              idempotencyValues(
                randomUUID(),
                organizationId,
              ),
            );
          },
        ),
      ).rejects.toMatchObject({
        code: "23503",
      });
    });

    it("rejects an unknown organization", async () => {
      const {
        tenantId,
      } = await createFoundation();

      await expect(
        withProvisioningAuthority(
          async (client) => {
            await insertIdempotency(
              client,
              idempotencyValues(
                tenantId,
                randomUUID(),
              ),
            );
          },
        ),
      ).rejects.toMatchObject({
        code: "23503",
      });
    });

    it("rejects lifecycle state other than PENDING", async () => {
      const {
        tenantId,
        organizationId,
      } = await createFoundation();

      const values = [
        ...idempotencyValues(
          tenantId,
          organizationId,
        ),
      ];

      values[5] = "ACTIVE";

      await expect(
        withProvisioningAuthority(
          async (client) => {
            await insertIdempotency(
              client,
              values,
            );
          },
        ),
      ).rejects.toMatchObject({
        code: "23514",
      });
    });

    it("rejects duplicate authority and idempotency key", async () => {
      const {
        tenantId,
        organizationId,
      } = await createFoundation();

      const values = idempotencyValues(
        tenantId,
        organizationId,
      );

      await withProvisioningAuthority(
        async (client) => {
          await insertIdempotency(
            client,
            values,
          );
        },
      );

      await expect(
        withProvisioningAuthority(
          async (client) => {
            await insertIdempotency(
              client,
              values,
            );
          },
        ),
      ).rejects.toMatchObject({
        code: "23505",
      });
    });
  },
);