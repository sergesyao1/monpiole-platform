import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RentalAllocation } from "../src/domain/rental-operations.js";
import { PostgresTemporalAvailabilityRepository } from "../src/infrastructure/persistence/postgres/postgres-temporal-availability-repository.js";

const POSTGRES_IMAGE =
  "postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687";
const OWNER_PASSWORD = "synthetic-owner-password";
const RUNTIME_PASSWORD = "synthetic-runtime-password";
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-09-27T10:00:00.000Z";

let container: StartedTestContainer;
let ownerPool: Pool;
let runtimePool: Pool;

function connectionString(user: string, password: string): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${container.getMappedPort(5432)}/rental_operations_test`;
}

beforeAll(async () => {
  container = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_DB: "rental_operations_test",
      POSTGRES_PASSWORD: OWNER_PASSWORD,
      POSTGRES_USER: "migration_owner",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  ownerPool = new Pool({ connectionString: connectionString("migration_owner", OWNER_PASSWORD) });
  await ownerPool.query(`CREATE ROLE monpiole_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await migrate(drizzle(ownerPool), { migrationsFolder });
  runtimePool = new Pool({ connectionString: connectionString("monpiole_runtime", RUNTIME_PASSWORD) });
});

afterEach(async () => {
  await ownerPool.query(`TRUNCATE rental_operations.rental_allocations,
    rental_operations.property_inspections, rental_operations.occupancies,
    rental_operations.operational_blocks, rental_operations.stays,
    rental_operations.bookings, rental_operations.leases CASCADE`);
});

afterAll(async () => {
  await runtimePool?.end();
  await ownerPool?.end();
  await container?.stop();
});

async function tenantTransaction<T>(tenantId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await runtimePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertLease(client: PoolClient, tenantId: string, leaseId = randomUUID()): Promise<string> {
  await client.query(`INSERT INTO rental_operations.leases
    (lease_id, tenant_id, rentable_asset_id, source_property_contract_id, mode, created_at)
    VALUES ($1, $2, $3, $4, 'LONG_TERM_RENTAL', $5)`,
  [leaseId, tenantId, assetId, randomUUID(), createdAt]);
  return leaseId;
}

async function insertBooking(client: PoolClient, tenantId: string, bookingId = randomUUID(), rentableAssetId = assetId): Promise<string> {
  await client.query(`INSERT INTO rental_operations.bookings
    (booking_id, tenant_id, rentable_asset_id, mode, arrival_at, departure_at, created_at)
    VALUES ($1, $2, $3, 'SHORT_TERM_RENTAL', '2026-10-01T14:00:00Z', '2026-10-05T10:00:00Z', $4)`,
  [bookingId, tenantId, rentableAssetId, createdAt]);
  return bookingId;
}

function bookingAllocation(bookingId: string, rentableAssetId: string, startsAt: string, endsAt: string) {
  return RentalAllocation.create({
    allocationId: randomUUID(),
    tenantId: tenantA,
    rentableAssetId,
    allocationType: "BOOKING",
    rentalMode: "SHORT_TERM_RENTAL",
    sourceBookingId: bookingId,
    startAt: startsAt,
    endAt: endsAt,
    status: "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  });
}

describe("Rental Operations PostgreSQL foundation", () => {
  it("persists Lease, Booking, Stay, both Occupancy modes and ENTRY/EXIT inspections", async () => {
    await tenantTransaction(tenantA, async (client) => {
      const leaseId = await insertLease(client, tenantA);
      const bookingId = await insertBooking(client, tenantA);
      const stayId = randomUUID();
      const longOccupancyId = randomUUID();
      const shortOccupancyId = randomUUID();
      await client.query(`INSERT INTO rental_operations.stays
        (stay_id, tenant_id, rentable_asset_id, booking_id, mode, created_at)
        VALUES ($1, $2, $3, $4, 'SHORT_TERM_RENTAL', $5)`, [stayId, tenantA, assetId, bookingId, createdAt]);
      await client.query(`INSERT INTO rental_operations.occupancies
        (occupancy_id, tenant_id, rentable_asset_id, mode, source_lease_id, started_at, created_at)
        VALUES ($1, $2, $3, 'LONG_TERM_RENTAL', $4, '2026-10-01T08:00:00Z', $5)`,
      [longOccupancyId, tenantA, assetId, leaseId, createdAt]);
      await client.query(`INSERT INTO rental_operations.occupancies
        (occupancy_id, tenant_id, rentable_asset_id, mode, source_stay_id, started_at, ended_at, created_at)
        VALUES ($1, $2, $3, 'SHORT_TERM_RENTAL', $4, '2026-10-01T14:00:00Z', '2026-10-05T10:00:00Z', $5)`,
      [shortOccupancyId, tenantA, assetId, stayId, createdAt]);
      for (const [occupancyId, mode] of [
        [longOccupancyId, "LONG_TERM_RENTAL"],
        [shortOccupancyId, "SHORT_TERM_RENTAL"],
      ] as const) {
        for (const inspectionType of ["ENTRY", "EXIT"] as const) {
          await client.query(`INSERT INTO rental_operations.property_inspections
            (inspection_id, tenant_id, occupancy_id, mode, inspection_type, occurred_at, created_at)
            VALUES ($1, $2, $3, $4, $5, '2026-10-01T14:05:00Z', $6)`,
          [randomUUID(), tenantA, occupancyId, mode, inspectionType, createdAt]);
        }
      }
      const result = await client.query(`SELECT
        (SELECT count(*) FROM rental_operations.leases)::int AS leases,
        (SELECT count(*) FROM rental_operations.bookings)::int AS bookings,
        (SELECT count(*) FROM rental_operations.stays)::int AS stays,
        (SELECT count(*) FROM rental_operations.occupancies)::int AS occupancies,
        (SELECT count(*) FROM rental_operations.property_inspections)::int AS inspections`);
      expect(result.rows[0]).toEqual({ leases: 1, bookings: 1, stays: 1, occupancies: 2, inspections: 4 });
    });
  });

  it("persists explicit Lease, Booking and OperationalBlock allocation provenance", async () => {
    await tenantTransaction(tenantA, async (client) => {
      const leaseId = await insertLease(client, tenantA);
      const bookingId = await insertBooking(client, tenantA);
      const blockId = randomUUID();
      await client.query(`INSERT INTO rental_operations.operational_blocks
        (operational_block_id, tenant_id, rentable_asset_id, reason, status, start_at, end_at, created_at, updated_at)
        VALUES ($1, $2, $3, 'MAINTENANCE', 'ACTIVE', '2026-11-01T08:00:00Z', '2026-11-02T18:00:00Z', $4, $4)`,
      [blockId, tenantA, assetId, createdAt]);
      await client.query(`INSERT INTO rental_operations.rental_allocations
        (allocation_id, tenant_id, rentable_asset_id, allocation_type, rental_mode, source_lease_id, start_at, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'LEASE', 'LONG_TERM_RENTAL', $4, '2026-10-01T00:00:00Z', 'ACTIVE', $5, $5)`,
      [randomUUID(), tenantA, assetId, leaseId, createdAt]);
      await client.query(`INSERT INTO rental_operations.rental_allocations
        (allocation_id, tenant_id, rentable_asset_id, allocation_type, rental_mode, source_booking_id, start_at, end_at, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'BOOKING', 'SHORT_TERM_RENTAL', $4, '2026-10-01T14:00:00Z', '2026-10-05T10:00:00Z', 'ACTIVE', $5, $5)`,
      [randomUUID(), tenantA, assetId, bookingId, createdAt]);
      await client.query(`INSERT INTO rental_operations.rental_allocations
        (allocation_id, tenant_id, rentable_asset_id, allocation_type, source_operational_block_id, start_at, end_at, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'OPERATIONAL_BLOCK', $4, '2026-11-01T08:00:00Z', '2026-11-02T18:00:00Z', 'ACTIVE', $5, $5)`,
      [randomUUID(), tenantA, assetId, blockId, createdAt]);
      const result = await client.query("SELECT allocation_type FROM rental_operations.rental_allocations ORDER BY allocation_type");
      expect(result.rows.map((row) => row.allocation_type)).toEqual(["BOOKING", "LEASE", "OPERATIONAL_BLOCK"]);
    });
  });

  it("rejects invalid intervals and ambiguous provenance", async () => {
    await expect(tenantTransaction(tenantA, async (client) => {
      await client.query(`INSERT INTO rental_operations.bookings
        (booking_id, tenant_id, rentable_asset_id, mode, arrival_at, departure_at, created_at)
        VALUES ($1, $2, $3, 'SHORT_TERM_RENTAL', '2026-10-05T10:00:00Z', '2026-10-01T14:00:00Z', $4)`,
      [randomUUID(), tenantA, assetId, createdAt]);
    })).rejects.toMatchObject({ code: "23514" });

    await expect(tenantTransaction(tenantA, async (client) => {
      const leaseId = await insertLease(client, tenantA);
      const bookingId = await insertBooking(client, tenantA);
      await client.query(`INSERT INTO rental_operations.rental_allocations
        (allocation_id, tenant_id, rentable_asset_id, allocation_type, rental_mode, source_lease_id, source_booking_id, start_at, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'LEASE', 'LONG_TERM_RENTAL', $4, $5, '2026-10-01T00:00:00Z', 'ACTIVE', $6, $6)`,
      [randomUUID(), tenantA, assetId, leaseId, bookingId, createdAt]);
    })).rejects.toMatchObject({ code: "23514" });
  });

  it("enforces tenant isolation and tenant-scoped provenance", async () => {
    const leaseId = await tenantTransaction(tenantA, (client) => insertLease(client, tenantA));
    await tenantTransaction(tenantB, async (client) => {
      expect((await client.query("SELECT * FROM rental_operations.leases")).rows).toEqual([]);
      await expect(client.query(`INSERT INTO rental_operations.occupancies
        (occupancy_id, tenant_id, rentable_asset_id, mode, source_lease_id, started_at, created_at)
        VALUES ($1, $2, $3, 'LONG_TERM_RENTAL', $4, '2026-10-01T08:00:00Z', $5)`,
      [randomUUID(), tenantB, assetId, leaseId, createdAt])).rejects.toMatchObject({ code: "23503" });
    });
  });

  it("rejects writes whose tenant differs from the authenticated database scope", async () => {
    await expect(tenantTransaction(tenantA, (client) => insertLease(client, tenantB)))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("allows multiple non-overlapping future bookings and exposes gaps", async () => {
    const repository = new PostgresTemporalAvailabilityRepository(runtimePool);
    const bookings = await tenantTransaction(tenantA, async (client) => Promise.all([
      insertBooking(client, tenantA),
      insertBooking(client, tenantA),
      insertBooking(client, tenantA),
    ]));
    await repository.commitIfAvailable(bookingAllocation(bookings[0]!, assetId, "2026-10-10T14:00:00Z", "2026-10-15T11:00:00Z"), [assetId]);
    await repository.commitIfAvailable(bookingAllocation(bookings[1]!, assetId, "2026-10-20T14:00:00Z", "2026-10-24T11:00:00Z"), [assetId]);
    await repository.commitIfAvailable(bookingAllocation(bookings[2]!, assetId, "2026-11-02T14:00:00Z", "2026-11-05T11:00:00Z"), [assetId]);
    await expect(repository.listActiveConflicts({
      tenantId: tenantA,
      conflictScopeIds: [assetId],
      startsAt: "2026-10-16T00:00:00Z",
      endsAt: "2026-10-19T00:00:00Z",
    })).resolves.toEqual([]);
  });

  it("commits exactly one of two concurrent overlapping allocations", async () => {
    const repository = new PostgresTemporalAvailabilityRepository(runtimePool);
    const [firstBooking, secondBooking] = await tenantTransaction(tenantA, async (client) => Promise.all([
      insertBooking(client, tenantA),
      insertBooking(client, tenantA),
    ]));
    const outcomes = await Promise.allSettled([
      repository.commitIfAvailable(bookingAllocation(firstBooking, assetId, "2026-10-10T14:00:00Z", "2026-10-15T11:00:00Z"), [assetId]),
      repository.commitIfAvailable(bookingAllocation(secondBooking, assetId, "2026-10-12T14:00:00Z", "2026-10-18T11:00:00Z"), [assetId]),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    const rows = await tenantTransaction(tenantA, (client) => client.query("SELECT allocation_id FROM rental_operations.rental_allocations"));
    expect(rows.rows).toHaveLength(1);
  });

  it("prevents whole-building claims from coexisting with unit claims", async () => {
    const repository = new PostgresTemporalAvailabilityRepository(runtimePool);
    const buildingId = "44444444-4444-4444-8444-444444444444";
    const unitId = "55555555-5555-4555-8555-555555555555";
    const [buildingBooking, unitBooking] = await tenantTransaction(tenantA, async (client) => Promise.all([
      insertBooking(client, tenantA, undefined, buildingId),
      insertBooking(client, tenantA, undefined, unitId),
    ]));
    await repository.commitIfAvailable(
      bookingAllocation(buildingBooking, buildingId, "2026-10-10T14:00:00Z", "2026-10-15T11:00:00Z"),
      [buildingId, unitId],
    );
    await expect(repository.commitIfAvailable(
      bookingAllocation(unitBooking, unitId, "2026-10-12T14:00:00Z", "2026-10-13T11:00:00Z"),
      [unitId],
    )).rejects.toMatchObject({ code: "23P01" });
  });

  it("allows sibling units to allocate independently", async () => {
    const repository = new PostgresTemporalAvailabilityRepository(runtimePool);
    const unitA = "66666666-6666-4666-8666-666666666666";
    const unitB = "77777777-7777-4777-8777-777777777777";
    const [bookingA, bookingB] = await tenantTransaction(tenantA, async (client) => Promise.all([
      insertBooking(client, tenantA, undefined, unitA),
      insertBooking(client, tenantA, undefined, unitB),
    ]));
    await repository.commitIfAvailable(bookingAllocation(bookingA, unitA, "2026-10-10T14:00:00Z", "2026-10-15T11:00:00Z"), [unitA]);
    await expect(repository.commitIfAvailable(bookingAllocation(bookingB, unitB, "2026-10-10T14:00:00Z", "2026-10-15T11:00:00Z"), [unitB])).resolves.toBeUndefined();
  });

});
