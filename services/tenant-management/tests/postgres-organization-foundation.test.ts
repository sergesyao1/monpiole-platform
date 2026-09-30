import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
    "/organization_foundation_test"
  );
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "organization_foundation_test",
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

async function createTenant(): Promise<string> {
  const tenantId = randomUUID();

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
        'Foundation Organization',
        'Ada Example',
        $2,
        '+2250102030405',
        'CI',
        'PENDING',
        '2026-09-25T12:00:00.000Z',
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

  return tenantId;
}

function organizationValues(
  tenantId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: randomUUID(),
    tenantId,
    organizationType: "REAL_ESTATE_AGENCY",
    legalName: "Example Immobilier CI",
    tradeName: "Example Immobilier",
    registrationNumber: `CI-ABJ-${randomUUID()}`,
    taxIdentifier: `TAX-${randomUUID()}`,
    phone: "+2250102030405",
    email: `organization-${randomUUID()}@example.invalid`,
    website: "https://example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    defaultLanguageCode: "fr",
    defaultLocale: "fr-CI",
    defaultCurrencyCode: "XOF",
    defaultTimezone: "Africa/Abidjan",
    createdAt: "2026-09-25T12:00:00.000Z",
    updatedAt: "2026-09-25T12:00:00.000Z",
    ...overrides,
  };
}

async function insertOrganization(
  pool: Pool | PoolClient,
  values: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `
      INSERT INTO tenant_management.organizations (
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
        country_code,
        default_language_code,
        default_locale,
        default_currency_code,
        default_timezone,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19
      )
    `,
    [
      values.id,
      values.tenantId,
      values.organizationType,
      values.legalName,
      values.tradeName,
      values.registrationNumber,
      values.taxIdentifier,
      values.phone,
      values.email,
      values.website,
      values.address,
      values.city,
      values.countryCode,
      values.defaultLanguageCode,
      values.defaultLocale,
      values.defaultCurrencyCode,
      values.defaultTimezone,
      values.createdAt,
      values.updatedAt,
    ],
  );
}

async function insertOrganizationAsProvisioner(
  values: Record<string, unknown>,
): Promise<void> {
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

    await insertOrganization(client, values);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe("Organization PostgreSQL foundation", () => {
  it("backfills only legacy CI organizations", async () => {
    const client = await ownerPool.connect();
    const migration = await readFile(
      new URL(
        "../migrations/0005_organization_international_configuration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    try {
      await client.query("BEGIN");
      await client.query(`
        ALTER TABLE tenant_management.organizations
          DROP CONSTRAINT organizations_international_all_or_none_check,
          DROP CONSTRAINT organizations_default_language_code_check,
          DROP CONSTRAINT organizations_default_currency_code_check,
          DROP COLUMN default_language_code,
          DROP COLUMN default_locale,
          DROP COLUMN default_currency_code,
          DROP COLUMN default_timezone
      `);

      for (const countryCode of ["CI", "GH"]) {
        const tenantId = await createTenant();
        const values = organizationValues(tenantId, { countryCode });
        await client.query(
          `INSERT INTO tenant_management.organizations (
             id, tenant_id, organization_type, legal_name, trade_name,
             registration_number, tax_identifier, phone, email, website,
             address, city, country_code, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15
           )`,
          [
            values.id, values.tenantId, values.organizationType,
            values.legalName, values.tradeName, values.registrationNumber,
            values.taxIdentifier, values.phone, values.email, values.website,
            values.address, values.city, values.countryCode,
            values.createdAt, values.updatedAt,
          ],
        );
      }

      await client.query(migration);
      const result = await client.query(`
        SELECT country_code, default_language_code, default_locale,
               default_currency_code, default_timezone
        FROM tenant_management.organizations
        ORDER BY country_code
      `);

      expect(result.rows).toEqual([
        {
          country_code: "CI",
          default_language_code: "fr",
          default_locale: "fr-CI",
          default_currency_code: "XOF",
          default_timezone: "Africa/Abidjan",
        },
        {
          country_code: "GH",
          default_language_code: null,
          default_locale: null,
          default_currency_code: null,
          default_timezone: null,
        },
      ]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("allows an authorized organization insert for an existing tenant", async () => {
    const tenantId = await createTenant();
    const values = organizationValues(tenantId);

    await expect(
      insertOrganizationAsProvisioner(values),
    ).resolves.toBeUndefined();

    const result = await ownerPool.query(
      `
        SELECT
          id,
          tenant_id,
          organization_type,
          legal_name,
          country_code,
          default_language_code,
          default_locale,
          default_currency_code,
          default_timezone
        FROM tenant_management.organizations
      `,
    );

    expect(result.rows).toEqual([
      {
        id: values.id,
        tenant_id: tenantId,
        organization_type: "REAL_ESTATE_AGENCY",
        legal_name: "Example Immobilier CI",
        country_code: "CI",
        default_language_code: "fr",
        default_locale: "fr-CI",
        default_currency_code: "XOF",
        default_timezone: "Africa/Abidjan",
      },
    ]);
  });

  it("fails closed without tenant:create platform authority", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganization(
        runtimePool,
        organizationValues(tenantId),
      ),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("rejects an organization referencing an unknown tenant", async () => {
    const values = organizationValues(randomUUID());

    await expect(
      insertOrganizationAsProvisioner(values),
    ).rejects.toMatchObject({
      code: "23503",
    });
  });

  it("rejects a second organization for the same tenant", async () => {
    const tenantId = await createTenant();

    await insertOrganizationAsProvisioner(
      organizationValues(tenantId),
    );

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId),
      ),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("rejects using the tenant id as the organization id", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId, {
          id: tenantId,
        }),
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects an unsupported organization type", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId, {
          organizationType: "UNSUPPORTED",
        }),
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects an invalid country code", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId, {
          countryCode: "CIV",
        }),
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects blank required business fields", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId, {
          legalName: "   ",
        }),
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects updated_at before created_at", async () => {
    const tenantId = await createTenant();

    await expect(
      insertOrganizationAsProvisioner(
        organizationValues(tenantId, {
          updatedAt: "2026-09-25T11:59:59.000Z",
        }),
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("keeps organization reads closed to the runtime role", async () => {
    const tenantId = await createTenant();

    await insertOrganizationAsProvisioner(
      organizationValues(tenantId),
    );

    const result = await runtimePool.query(
      "SELECT * FROM tenant_management.organizations",
    );

    expect(result.rows).toHaveLength(0);
  });
});
