import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

import type { ActivateTenantAdministratorStore } from "../../../application/activate-tenant-administrator.js";
import { BootstrapAdministratorConflictError, type BootstrapAdministratorStore } from "../../../application/bootstrap-tenant-administrator.js";
import type { ActiveTenantAdministratorStore } from "../../../application/has-active-tenant-administrator.js";
import { Identity, TenantMembership } from "../../../domain/identity.js";
import { identities, tenantMemberships } from "./schema.js";

const CONFLICT_CONSTRAINTS = new Set([
  "identities_pkey", "identities_email_unique", "identities_id_tenant_unique",
  "tenant_memberships_pkey", "tenant_memberships_identity_unique",
]);

export class PostgresIdentityStore implements
BootstrapAdministratorStore, ActivateTenantAdministratorStore, ActiveTenantAdministratorStore {
  constructor(private readonly pool: Pool) {}

  findIdentityByEmail(email: string, tenantId: string): Promise<Identity | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(identities).where(and(
        eq(identities.email, email), eq(identities.tenantId, tenantId),
      )).limit(1))[0];
      return row === undefined ? undefined : toIdentity(row);
    });
  }

  findIdentityById(administratorId: string, tenantId: string): Promise<Identity | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(identities).where(and(
        eq(identities.id, administratorId), eq(identities.tenantId, tenantId),
      )).limit(1))[0];
      return row === undefined ? undefined : toIdentity(row);
    });
  }

  findMembership(tenantId: string): Promise<TenantMembership | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(tenantMemberships)
        .where(eq(tenantMemberships.tenantId, tenantId)).limit(1))[0];
      return row === undefined ? undefined : TenantMembership.rehydrate(row.tenantId, row.identityId);
    });
  }

  async saveAtomically(identity: Identity, membership: TenantMembership, correlationId: string): Promise<void> {
    try {
      await withTenantPostgresTransaction(this.pool, membership.tenantId, async (scope) => {
        await scope.database().insert(identities).values({
          id: identity.id, tenantId: membership.tenantId, email: identity.email,
          firstName: identity.firstName, lastName: identity.lastName,
          status: identity.status, correlationId,
        });
        await scope.database().insert(tenantMemberships).values({
          tenantId: membership.tenantId, identityId: membership.identityId,
          role: membership.role, correlationId,
        });
      });
    } catch (error) {
      if (CONFLICT_CONSTRAINTS.has(postgresConstraint(error) ?? "")) {
        throw new BootstrapAdministratorConflictError();
      }
      throw error;
    }
  }

  async saveActivatedIdentity(identity: Identity, tenantId: string, correlationId: string): Promise<void> {
    await withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      await scope.database().update(identities).set({ status: identity.status, correlationId })
        .where(and(eq(identities.id, identity.id), eq(identities.tenantId, tenantId)));
    });
  }
}

function toIdentity(row: typeof identities.$inferSelect): Identity {
  if (row.status !== "PENDING_ACTIVATION" && row.status !== "ACTIVE") {
    throw new Error("Unsupported persisted Identity status");
  }
  return Identity.rehydrate({
    id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, status: row.status,
  });
}

function postgresConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    if ("constraint" in current && typeof current.constraint === "string") return current.constraint;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
