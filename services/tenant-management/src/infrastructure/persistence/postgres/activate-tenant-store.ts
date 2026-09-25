import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";

import type {
  ActivateTenantTransaction,
  ActivateTenantUnitOfWork,
  TenantActivatedRecord,
} from "../../../application/activate-tenant.js";
import { Tenant } from "../../../domain/tenant.js";
import { serializeTenantActivated, tenantActivatedEventType } from "../../events/tenant-activated.js";
import { tenantOutbox, tenants } from "./schema.js";

export class PostgresActivateTenantUnitOfWork implements ActivateTenantUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async execute<Result>(
    tenantId: string,
    operation: (transaction: ActivateTenantTransaction) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query("SELECT set_config('app.tenant_capability', 'tenant:activate', true)");
      const result = await operation(new PostgresActivateTenantTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

class PostgresActivateTenantTransaction implements ActivateTenantTransaction {
  private readonly database: NodePgDatabase;
  constructor(private readonly client: PoolClient) { this.database = drizzle(client); }

  async findTenantForUpdate(tenantId: string): Promise<Tenant | undefined> {
    const result = await this.client.query<{
      id: string; organization_name: string; responsible_person_name: string; responsible_email: string;
      responsible_telephone: string; country: string; lifecycle_state: "PENDING" | "ACTIVE";
      created_at: Date; activated_at: Date | null;
    }>(`SELECT id, organization_name, responsible_person_name, responsible_email, responsible_telephone,
      country, lifecycle_state, created_at, activated_at
      FROM tenant_management.tenants WHERE id = $1 FOR UPDATE`, [tenantId]);
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return Tenant.reconstitute({
      id: row.id, organizationName: row.organization_name, responsiblePersonName: row.responsible_person_name,
      responsibleEmail: row.responsible_email, responsibleTelephone: row.responsible_telephone,
      country: row.country, lifecycleState: row.lifecycle_state, createdAt: row.created_at.toISOString(),
      ...(row.activated_at === null ? {} : { activatedAt: row.activated_at.toISOString() }),
    });
  }

  async updateTenant(tenant: Tenant): Promise<void> {
    await this.database.update(tenants).set({
      lifecycleState: tenant.lifecycleState,
      activatedAt: tenant.activatedAt,
    }).where(eq(tenants.id, tenant.values.id));
  }

  async recordTenantActivated(event: TenantActivatedRecord): Promise<void> {
    const envelope = JSON.parse(serializeTenantActivated(event)) as Record<string, unknown>;
    await this.database.insert(tenantOutbox).values({
      eventId: event.eventId, tenantId: event.tenantId, eventType: tenantActivatedEventType,
      eventVersion: "1", occurredAt: event.occurredAt, correlationId: event.correlationId, envelope,
    });
  }
}
