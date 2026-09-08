import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ActivatePropertyContract, CreateProperty, CreatePropertyClient, CreatePropertyContract, EndPropertyContract,
  PostgresPropertyClientRepository, PostgresPropertyContractRepository, PostgresPropertyRepository,
  PostgresPropertyWorkspaceSummaryQuery, PropertyContractNotFoundError, RetrievePropertyContract,
  type PropertyAuthority,
} from "../src/index.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLIENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONTRACT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CORRELATION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const REPLAY_CORRELATION = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-09-08T10:00:00.000Z";
const ACTIVE_AT = "2026-09-08T11:00:00.000Z";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

let container: StartedTestContainer;
let owner: Pool;
let runtime: Pool;
let publicReader: Pool;

function connection(user: string, password: string, database = "property_client_contract_test") {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/${database}`;
}
function authority(tenantId = TENANT_A): PropertyAuthority {
  return {
    actorId: "administrator", authorityId: "administrator", tenantIds: [tenantId],
    grants: ["CREATE_PROPERTY", "CREATE_PROPERTY_CLIENT", "RETRIEVE_PROPERTY_CLIENTS", "CREATE_PROPERTY_CONTRACT",
      "RETRIEVE_PROPERTY_CONTRACTS", "UPDATE_PROPERTY_CONTRACT", "MANAGE_PROPERTY_CONTRACT_LIFECYCLE"],
  };
}

beforeAll(async () => {
  container = await new GenericContainer(IMAGE)
    .withEnvironment({ POSTGRES_DB: "property_client_contract_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
  owner = new Pool({ connectionString: connection("owner", "synthetic-owner") });
  await owner.query("CREATE ROLE monpiole_runtime LOGIN PASSWORD 'synthetic-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await owner.query("CREATE ROLE monpiole_public_catalog_reader LOGIN PASSWORD 'synthetic-public-reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(owner), { migrationsFolder });
  await owner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    property_management.properties,
    property_management.property_buildings,
    property_management.property_building_units,
    property_management.property_owners,
    property_management.property_ownerships,
    property_management.property_photos,
    property_management.property_photo_standards
    TO monpiole_runtime`);
  runtime = new Pool({ connectionString: connection("monpiole_runtime", "synthetic-runtime") });
  publicReader = new Pool({ connectionString: connection("monpiole_public_catalog_reader", "synthetic-public-reader") });
});

afterEach(async () => owner.query(`TRUNCATE
  property_management.property_contracts,
  property_management.property_clients,
  property_management.property_building_units,
  property_management.property_buildings,
  property_management.properties CASCADE`));

afterAll(async () => { await publicReader?.end(); await runtime?.end(); await owner?.end(); await container?.stop(); });

async function createFixtures() {
  const properties = new PostgresPropertyRepository(runtime);
  await new CreateProperty(properties, { generate: () => PROPERTY_ID }, { now: () => NOW }).execute({
    authority: authority(), correlationId: CORRELATION, title: "Maison Lagune", propertyType: "HOUSE",
    transactionType: "LONG_TERM_RENTAL", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
  const clients = new PostgresPropertyClientRepository(runtime);
  await new CreatePropertyClient(clients, { generate: () => CLIENT_ID }, { now: () => NOW }).execute({
    authority: authority(), correlationId: CORRELATION, displayName: "Awa Koné", email: "AWA@EXAMPLE.COM",
  });
  const contracts = new PostgresPropertyContractRepository(runtime);
  await new CreatePropertyContract(contracts, clients, properties, { generate: () => CONTRACT_ID }, { now: () => NOW }).execute({
    authority: authority(), correlationId: CORRELATION, propertyId: PROPERTY_ID, clientId: CLIENT_ID,
    contractType: "LEASE", reference: "bail-2026-001", startDate: "2026-10-01",
  });
  return { properties, clients, contracts };
}

describe("Property client and contract PostgreSQL persistence", () => {
  it("upgrades 0016 to 0017 without modifying legacy Properties or backfilling private records", async () => {
    const previous = await migrationsThrough(16);
    await owner.query("CREATE DATABASE property_client_contract_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_client_contract_upgrade_test") });
    try {
      await migrate(drizzle(upgrade), { migrationsFolder: previous });
      await upgrade.query(`INSERT INTO property_management.properties
        (property_id, tenant_id, title, property_type, transaction_type, status, country, city, district, address_line,
         created_at, updated_at, correlation_id, actor_id)
        VALUES ($1,$2,'Bien historique','HOUSE','SALE','DRAFT','CI','Abidjan','Cocody','Riviera',now(),now(),$3,'historical')`,
      [PROPERTY_ID, TENANT_A, CORRELATION]);
      await migrate(drizzle(upgrade), { migrationsFolder });
      expect((await upgrade.query("SELECT title, structural_role FROM property_management.properties WHERE property_id = $1", [PROPERTY_ID])).rows[0])
        .toEqual({ title: "Bien historique", structural_role: "STANDALONE" });
      expect((await upgrade.query(`SELECT
        (SELECT count(*)::int FROM property_management.property_clients) AS clients,
        (SELECT count(*)::int FROM property_management.property_contracts) AS contracts`)).rows[0])
        .toEqual({ clients: 0, contracts: 0 });
    } finally { await upgrade.end(); await rm(previous, { recursive: true, force: true }); }
  });

  it("installs forced RLS, tenant policies and least-privilege runtime grants", async () => {
    expect((await owner.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE oid IN ('property_management.property_clients'::regclass, 'property_management.property_contracts'::regclass)
      ORDER BY relname`)).rows).toEqual([
      { relname: "property_clients", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "property_contracts", relrowsecurity: true, relforcerowsecurity: true },
    ]);
    expect((await owner.query(`SELECT table_name, privilege_type FROM information_schema.table_privileges
      WHERE table_schema = 'property_management' AND table_name IN ('property_clients','property_contracts')
        AND grantee = 'monpiole_runtime' ORDER BY table_name, privilege_type`)).rows).toEqual([
      { table_name: "property_clients", privilege_type: "INSERT" },
      { table_name: "property_clients", privilege_type: "SELECT" },
      { table_name: "property_contracts", privilege_type: "INSERT" },
      { table_name: "property_contracts", privilege_type: "SELECT" },
      { table_name: "property_contracts", privilege_type: "UPDATE" },
    ]);
    expect((await owner.query(`SELECT count(*)::int AS count FROM information_schema.table_privileges
      WHERE table_schema = 'property_management' AND table_name IN ('property_clients','property_contracts')
        AND grantee = 'monpiole_public_catalog_reader'`)).rows[0]).toEqual({ count: 0 });
  });

  it("persists, joins and transitions a contract idempotently with audit trace", async () => {
    const { contracts } = await createFixtures();
    const command = { authority: authority(), correlationId: CORRELATION, propertyId: PROPERTY_ID, contractId: CONTRACT_ID };
    const activate = new ActivatePropertyContract(contracts, { now: () => ACTIVE_AT });
    await activate.execute(command);
    await activate.execute({ ...command, correlationId: REPLAY_CORRELATION });
    const row = (await owner.query(`SELECT status, reference, activated_at, activated_by_actor_id,
      activation_correlation_id, correlation_id FROM property_management.property_contracts`)).rows[0];
    expect({ ...row, activated_at: row.activated_at.toISOString() }).toEqual({
      status: "ACTIVE", reference: "BAIL-2026-001", activated_at: ACTIVE_AT,
      activated_by_actor_id: "administrator", activation_correlation_id: CORRELATION, correlation_id: CORRELATION,
    });
    const ended = await new EndPropertyContract(contracts, { now: () => "2026-12-31T10:00:00.000Z" }).execute({
      ...command, correlationId: REPLAY_CORRELATION, endDate: "2026-12-31",
    });
    expect(ended).toMatchObject({ status: "ENDED", client: { displayName: "Awa Koné" } });
    const summary = await new PostgresPropertyWorkspaceSummaryQuery(runtime).retrieve(TENANT_A, PROPERTY_ID);
    expect(summary?.contracts).toEqual({ totalCount: 1, draftCount: 0, activeCount: 0, endedCount: 1, cancelledCount: 0 });
  });

  it("enforces reference/check/FK constraints and forbids destructive runtime access", async () => {
    await createFixtures();
    await expect(owner.query(`INSERT INTO property_management.property_contracts
      (contract_id, tenant_id, property_id, client_id, contract_type, status, reference, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,$4,'LEASE','DRAFT','bail-lowercase',$5,$5,$6,'actor')`,
    ["22222222-2222-4222-8222-222222222222", TENANT_A, PROPERTY_ID, CLIENT_ID, NOW, CORRELATION]))
      .rejects.toMatchObject({ code: "23514" });
    await expect(owner.query(`INSERT INTO property_management.property_contracts
      (contract_id, tenant_id, property_id, client_id, contract_type, status, reference, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,$4,'OTHER','DRAFT','CROSS-TENANT',$5,$5,$6,'actor')`,
    ["33333333-3333-4333-8333-333333333333", TENANT_B, PROPERTY_ID, CLIENT_ID, NOW, CORRELATION]))
      .rejects.toMatchObject({ code: "23503" });
    await expect(runtime.query("DELETE FROM property_management.property_contracts"))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("isolates tenant reads, requires context and denies every public catalogue access", async () => {
    const { contracts } = await createFixtures();
    await expect(new RetrievePropertyContract(contracts).execute({
      authority: authority(TENANT_B), propertyId: PROPERTY_ID, contractId: CONTRACT_ID,
    })).rejects.toBeInstanceOf(PropertyContractNotFoundError);
    expect((await runtime.query("SELECT * FROM property_management.property_clients")).rows).toHaveLength(0);
    expect((await runtime.query("SELECT * FROM property_management.property_contracts")).rows).toHaveLength(0);
    await expect(publicReader.query("SELECT * FROM property_management.property_clients")).rejects.toMatchObject({ code: "42501" });
    await expect(publicReader.query("SELECT * FROM property_management.property_contracts")).rejects.toMatchObject({ code: "42501" });
  });
});

async function migrationsThrough(lastIndex: number) {
  const folder = await mkdtemp(join(tmpdir(), `monpiole-property-${String(lastIndex).padStart(4, "0")}-`));
  const meta = join(folder, "meta"); await mkdir(meta);
  const journal = JSON.parse(await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    readonly entries: readonly { readonly idx: number; readonly tag: string }[];
  };
  const entries = journal.entries.filter((entry) => entry.idx <= lastIndex);
  for (const entry of entries) {
    const prefix = String(entry.idx).padStart(4, "0");
    await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
    await copyFile(join(migrationsFolder, "meta", `${prefix}_snapshot.json`), join(meta, `${prefix}_snapshot.json`));
  }
  await writeFile(join(meta, "_journal.json"), `${JSON.stringify({ ...journal, entries }, null, 2)}\n`, "utf8");
  return folder;
}
