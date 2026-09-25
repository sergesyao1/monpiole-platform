import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";

import {
  DuplicateTenantEmailError,
  IdempotencyWriteConflictError,
  type CreateTenantTransaction,
  type CreateTenantUnitOfWork,
  type IdempotencyRecord,
  type TenantCreatedRecord,
} from "../../../application/create-tenant.js";
import { Tenant } from "../../../domain/tenant.js";
import { serializeTenantCreated, tenantCreatedEventType } from "../../events/tenant-created.js";
import { createTenantIdempotency, tenantOutbox, tenants } from "./schema.js";

const EMAIL_CONSTRAINT = "tenants_responsible_email_unique";
const IDEMPOTENCY_CONSTRAINT = "create_tenant_idempotency_authority_key_unique";

export class PostgresCreateTenantUnitOfWork implements CreateTenantUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async execute<Result>(operation: (transaction: CreateTenantTransaction) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      await client.query("SELECT set_config('app.platform_authority', 'tenant:create', true)");
      const result = await operation(new PostgresCreateTenantTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      const constraint = postgresConstraint(error);
      if (constraint === EMAIL_CONSTRAINT) throw new DuplicateTenantEmailError();
      if (constraint === IDEMPOTENCY_CONSTRAINT) throw new IdempotencyWriteConflictError();
      throw error;
    } finally {
      client.release();
    }
  }
}

class PostgresCreateTenantTransaction implements CreateTenantTransaction {
  private readonly database: NodePgDatabase;
  constructor(private readonly client: PoolClient) { this.database = drizzle(client); }

  async acquireIdempotencyKey(authorityId: string, idempotencyKey: string): Promise<void> {
    await this.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [JSON.stringify([authorityId, idempotencyKey])],
    );
  }

  async findIdempotency(authorityId: string, idempotencyKey: string): Promise<IdempotencyRecord | undefined> {
    const row = (await this.database.select().from(createTenantIdempotency).where(and(
      eq(createTenantIdempotency.authorityId, authorityId),
      eq(createTenantIdempotency.idempotencyKey, idempotencyKey),
    )).limit(1))[0];
    if (row === undefined) return undefined;
    return {
      authorityId: row.authorityId,
      idempotencyKey: row.idempotencyKey,
      normalizedIntent: row.normalizedIntent,
      result: { tenantId: row.tenantId, lifecycleState: "PENDING", createdAt: new Date(row.createdAt).toISOString() },
      correlationId: row.correlationId,
      actorId: row.actorId,
    };
  }

  async findByResponsibleEmail(email: string): Promise<Tenant | undefined> {
    const row = (await this.database.select().from(tenants).where(eq(tenants.responsibleEmail, email)).limit(1))[0];
    if (row === undefined) return undefined;
    return Tenant.create({
      id: row.id, organizationName: row.organizationName,
      responsiblePersonName: row.responsiblePersonName,
      responsibleEmail: row.responsibleEmail,
      responsibleTelephone: row.responsibleTelephone,
      country: row.country, createdAt: new Date(row.createdAt).toISOString(),
    });
  }

  async insertTenant(tenant: Tenant, trace: { correlationId: string; actorId: string; authorityId: string }): Promise<void> {
    await this.database.insert(tenants).values({
      id: tenant.values.id, organizationName: tenant.values.organizationName,
      responsiblePersonName: tenant.values.responsiblePersonName,
      responsibleEmail: tenant.values.responsibleEmail,
      responsibleTelephone: tenant.values.responsibleTelephone,
      country: tenant.values.country, lifecycleState: tenant.lifecycleState,
      createdAt: tenant.values.createdAt, ...trace,
    });
  }

  async insertIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.database.insert(createTenantIdempotency).values({
      authorityId: record.authorityId, idempotencyKey: record.idempotencyKey,
      normalizedIntent: record.normalizedIntent, tenantId: record.result.tenantId,
      lifecycleState: record.result.lifecycleState, createdAt: record.result.createdAt,
      correlationId: record.correlationId, actorId: record.actorId,
    });
  }

  async recordTenantCreated(event: TenantCreatedRecord): Promise<void> {
    const envelope = JSON.parse(serializeTenantCreated(event)) as Record<string, unknown>;
    await this.database.insert(tenantOutbox).values({
      eventId: event.eventId, tenantId: event.tenantId,
      eventType: tenantCreatedEventType, eventVersion: "1",
      occurredAt: event.occurredAt, correlationId: event.correlationId, envelope,
    });
  }
}

function postgresConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    if ("constraint" in current && typeof current.constraint === "string") return current.constraint;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
