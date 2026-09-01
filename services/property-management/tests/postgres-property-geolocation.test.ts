import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CreateProperty,
  PostgresPropertyGeolocationRepository,
  PostgresPropertyRepository,
  PropertyNotFoundError,
  PropertyUnitGeolocationInheritedError,
  RemovePropertyGeolocation,
  RetrievePropertyGeolocation,
  UpdatePropertyGeolocation,
  type PropertyAuthority,
} from "../src/index.js";

const IMAGE = "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNIT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const BUILDING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CORRELATION = "11111111-1111-4111-8111-111111111111";
const REPLAY_CORRELATION = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-31T12:00:00.000Z";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

let container: StartedTestContainer;
let owner: Pool;
let runtime: Pool;
let publicReader: Pool;

function connection(user: string, password: string, database = "property_geolocation_test") {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/${database}`;
}

function authority(tenantId: string, grants: PropertyAuthority["grants"] = [
  "CREATE_PROPERTY", "RETRIEVE_PROPERTY_GEOLOCATION", "UPDATE_PROPERTY_GEOLOCATION", "REMOVE_PROPERTY_GEOLOCATION",
]): PropertyAuthority {
  return { actorId: "tenant-admin", authorityId: "tenant-admin", grants, tenantIds: [tenantId] };
}

beforeAll(async () => {
  container = await new GenericContainer(IMAGE)
    .withEnvironment({
      POSTGRES_DB: "property_geolocation_test", POSTGRES_USER: "owner", POSTGRES_PASSWORD: "synthetic-owner",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  owner = new Pool({ connectionString: connection("owner", "synthetic-owner") });
  await owner.query("CREATE ROLE monpiole_runtime LOGIN PASSWORD 'synthetic-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await owner.query("CREATE ROLE monpiole_public_catalog_reader LOGIN PASSWORD 'synthetic-public-reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
  await migrate(drizzle(owner), { migrationsFolder });
  await owner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    property_management.properties,
    property_management.property_buildings,
    property_management.property_building_units
    TO monpiole_runtime`);
  runtime = new Pool({ connectionString: connection("monpiole_runtime", "synthetic-runtime") });
  publicReader = new Pool({ connectionString: connection("monpiole_public_catalog_reader", "synthetic-public-reader") });
});

afterEach(async () => owner.query(`TRUNCATE
  property_management.property_geolocations,
  property_management.property_building_units,
  property_management.property_buildings,
  property_management.properties CASCADE`));

afterAll(async () => {
  await publicReader?.end(); await runtime?.end(); await owner?.end(); await container?.stop();
});

async function create(propertyId = PROPERTY_ID, tenantId = TENANT_A) {
  await new CreateProperty(new PostgresPropertyRepository(runtime), { generate: () => propertyId }, { now: () => NOW }).execute({
    authority: authority(tenantId), correlationId: CORRELATION, title: "Maison Lagune", propertyType: "HOUSE",
    transactionType: "SALE", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  });
}

function updater(clock = NOW) {
  return new UpdatePropertyGeolocation(new PostgresPropertyGeolocationRepository(runtime), { now: () => clock });
}

describe("Property geolocation PostgreSQL persistence", () => {
  it("upgrades 0011 to 0012 without backfill or modifying historical Properties", async () => {
    const previous = await migrationsThrough(11);
    await owner.query("CREATE DATABASE property_geolocation_upgrade_test");
    const upgrade = new Pool({ connectionString: connection("owner", "synthetic-owner", "property_geolocation_upgrade_test") });
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
      expect((await upgrade.query("SELECT count(*)::int AS count FROM property_management.property_geolocations")).rows[0])
        .toEqual({ count: 0 });
    } finally {
      await upgrade.end();
      await rm(previous, { recursive: true, force: true });
    }
  });

  it("installs provider-neutral numeric columns, checks, runtime grants and forced tenant RLS", async () => {
    expect((await owner.query(`SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns WHERE table_schema = 'property_management'
        AND table_name = 'property_geolocations' AND column_name IN ('latitude','longitude') ORDER BY column_name`)).rows)
      .toEqual([
        { column_name: "latitude", data_type: "numeric", numeric_precision: 8, numeric_scale: 6 },
        { column_name: "longitude", data_type: "numeric", numeric_precision: 9, numeric_scale: 6 },
      ]);
    expect((await owner.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE oid = 'property_management.property_geolocations'::regclass`)).rows[0])
      .toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    expect((await owner.query(`SELECT policyname, cmd, roles, qual LIKE '%app.tenant_id%' AS tenant_qual,
        with_check LIKE '%app.tenant_id%' AS tenant_check
      FROM pg_policies WHERE schemaname = 'property_management' AND tablename = 'property_geolocations'`)).rows)
      .toEqual([{ policyname: "property_geolocations_tenant_isolation", cmd: "ALL", roles: "{public}", tenant_qual: true, tenant_check: true }]);
    expect((await owner.query(`SELECT privilege_type FROM information_schema.table_privileges
      WHERE table_schema = 'property_management' AND table_name = 'property_geolocations'
        AND grantee = 'monpiole_runtime' ORDER BY privilege_type`)).rows)
      .toEqual([{ privilege_type: "DELETE" }, { privilege_type: "INSERT" }, { privilege_type: "SELECT" }, { privilege_type: "UPDATE" }]);
  });

  it("creates, retrieves, replaces, replays and idempotently removes own coordinates with trace", async () => {
    await create();
    const command = {
      authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: PROPERTY_ID,
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "APPROXIMATE" as const,
    };
    await expect(updater().execute(command)).resolves.toMatchObject({ configured: true, source: "OWN" });
    await expect(new RetrievePropertyGeolocation(new PostgresPropertyGeolocationRepository(runtime)).execute({
      authority: authority(TENANT_A), propertyId: PROPERTY_ID,
    })).resolves.toEqual({
      configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123,
      publicVisibility: "APPROXIMATE",
    });
    await updater("2026-08-31T13:00:00.000Z").execute({ ...command, correlationId: REPLAY_CORRELATION });
    let row = (await owner.query(`SELECT latitude::text, longitude::text, public_visibility, updated_at,
      correlation_id, actor_id FROM property_management.property_geolocations`)).rows[0];
    expect({ ...row, updated_at: row.updated_at.toISOString() }).toEqual({
      latitude: "5.336789", longitude: "-4.027123", public_visibility: "APPROXIMATE",
      updated_at: NOW, correlation_id: CORRELATION, actor_id: "tenant-admin",
    });
    await updater("2026-08-31T14:00:00.000Z").execute({
      ...command, correlationId: REPLAY_CORRELATION, latitude: 5.35, longitude: -4.01, publicVisibility: "HIDDEN",
    });
    row = (await owner.query("SELECT latitude::text, longitude::text, public_visibility FROM property_management.property_geolocations")).rows[0];
    expect(row).toEqual({ latitude: "5.350000", longitude: "-4.010000", public_visibility: "HIDDEN" });
    const remove = new RemovePropertyGeolocation(new PostgresPropertyGeolocationRepository(runtime));
    await expect(remove.execute({ authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: PROPERTY_ID })).resolves.toBeUndefined();
    await expect(remove.execute({ authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: PROPERTY_ID })).resolves.toBeUndefined();
  });

  it("enforces database bounds and visibility checks", async () => {
    await create();
    const insert = (latitude: number, longitude: number, visibility: string) => owner.query(`INSERT INTO property_management.property_geolocations
      (tenant_id, property_id, latitude, longitude, public_visibility, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'actor')`, [TENANT_A, PROPERTY_ID, latitude, longitude, visibility, NOW, CORRELATION]);
    await expect(insert(90.000001, 0, "HIDDEN")).rejects.toMatchObject({ code: "23514" });
    await expect(insert(0, -180.000001, "HIDDEN")).rejects.toMatchObject({ code: "23514" });
    await expect(insert(0, 0, "PUBLIC")).rejects.toMatchObject({ code: "23514" });
  });

  it("isolates tenants, requires tenant context and denies the public catalog reader any coordinate access", async () => {
    await create();
    await updater().execute({
      authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: PROPERTY_ID,
      latitude: 5, longitude: -4, publicVisibility: "EXACT",
    });
    await expect(new RetrievePropertyGeolocation(new PostgresPropertyGeolocationRepository(runtime)).execute({
      authority: authority(TENANT_B), propertyId: PROPERTY_ID,
    })).rejects.toBeInstanceOf(PropertyNotFoundError);
    expect((await runtime.query("SELECT * FROM property_management.property_geolocations")).rows).toHaveLength(0);
    await expect(runtime.query(`INSERT INTO property_management.property_geolocations
      (tenant_id, property_id, latitude, longitude, public_visibility, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,5,-4,'HIDDEN',$3,$4,'actor')`, [TENANT_A, PROPERTY_ID, NOW, CORRELATION]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(publicReader.query("SELECT * FROM property_management.property_geolocations"))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("makes a Unit inherit its COMPOSITE parent and rejects own update or removal", async () => {
    await create(PARENT_ID);
    await owner.query("UPDATE property_management.properties SET structural_role = 'COMPOSITE' WHERE property_id = $1", [PARENT_ID]);
    await owner.query(`INSERT INTO property_management.properties
      (property_id, tenant_id, title, property_type, transaction_type, status, structural_role,
       country, city, district, address_line, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,'Unité A-101','APARTMENT','SALE','DRAFT','UNIT','CI','Abidjan','Cocody','A-101',$3,$3,$4,'actor')`,
    [UNIT_ID, TENANT_A, NOW, CORRELATION]);
    await owner.query(`INSERT INTO property_management.property_buildings
      (building_id, tenant_id, property_id, building_code, name, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,'BAT-A','Immeuble A',$4,$4,$5,'actor')`, [BUILDING_ID, TENANT_A, PARENT_ID, NOW, CORRELATION]);
    await owner.query(`INSERT INTO property_management.property_building_units
      (tenant_id, building_id, unit_property_id, unit_code, created_at, updated_at, correlation_id, actor_id)
      VALUES ($1,$2,$3,'A-101',$4,$4,$5,'actor')`, [TENANT_A, BUILDING_ID, UNIT_ID, NOW, CORRELATION]);
    await updater().execute({
      authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: PARENT_ID,
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN",
    });
    const repository = new PostgresPropertyGeolocationRepository(runtime);
    await expect(new RetrievePropertyGeolocation(repository).execute({ authority: authority(TENANT_A), propertyId: UNIT_ID }))
      .resolves.toEqual({
        configured: true, source: "INHERITED", inheritedFromPropertyId: PARENT_ID,
        latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN",
      });
    await expect(updater().execute({
      authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: UNIT_ID,
      latitude: 5, longitude: -4, publicVisibility: "HIDDEN",
    })).rejects.toBeInstanceOf(PropertyUnitGeolocationInheritedError);
    await expect(new RemovePropertyGeolocation(repository).execute({
      authority: authority(TENANT_A), correlationId: CORRELATION, propertyId: UNIT_ID,
    })).rejects.toBeInstanceOf(PropertyUnitGeolocationInheritedError);
    expect((await owner.query("SELECT count(*)::int AS count FROM property_management.property_geolocations WHERE property_id = $1", [UNIT_ID])).rows[0])
      .toEqual({ count: 0 });
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
