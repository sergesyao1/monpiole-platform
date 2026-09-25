import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, eq } from "drizzle-orm";
import type { Pool } from "pg";

import {
  PropertyOwnershipPersistenceFailureError,
  type AssignPropertyOwnershipResult, type PropertyOwnershipRepository, type RemovePropertyOwnershipResult,
} from "../../../application/property-ownership-repository.js";
import {
  PropertyOwnership, PropertyOwnershipShareExceededError, assertOwnershipShareCapacity,
} from "../../../domain/property-ownership.js";
import { properties, propertyOwners, propertyOwnerships } from "./schema.js";

export class PostgresPropertyOwnershipRepository implements PropertyOwnershipRepository {
  constructor(private readonly pool: Pool) {}

  assignAtomically(ownership: PropertyOwnership): Promise<AssignPropertyOwnershipResult> {
    const value = ownership.values;
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, value.tenantId, async (scope) => {
      const property = (await scope.database().select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, value.tenantId), eq(properties.propertyId, value.propertyId),
      )).limit(1).for("update"))[0];
      if (property === undefined) return "PROPERTY_NOT_FOUND";

      const owner = (await scope.database().select({ ownerId: propertyOwners.ownerId }).from(propertyOwners).where(and(
        eq(propertyOwners.tenantId, value.tenantId), eq(propertyOwners.ownerId, value.ownerId),
      )).limit(1))[0];
      if (owner === undefined) return "OWNER_NOT_FOUND";

      const existing = await scope.database().select({
        ownerId: propertyOwnerships.ownerId, ownershipShare: propertyOwnerships.ownershipShare,
      }).from(propertyOwnerships).where(and(
        eq(propertyOwnerships.tenantId, value.tenantId), eq(propertyOwnerships.propertyId, value.propertyId),
      ));
      if (existing.some((item) => item.ownerId === value.ownerId)) return "DUPLICATE";
      assertOwnershipShareCapacity(existing.map((item) => item.ownershipShare), value.ownershipShare);
      await scope.database().insert(propertyOwnerships).values(value);
      return "ASSIGNED";
    }));
  }

  listByProperty(tenantId: string, propertyId: string): Promise<readonly PropertyOwnership[] | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1))[0];
      if (property === undefined) return undefined;
      const rows = await scope.database().select().from(propertyOwnerships).where(and(
        eq(propertyOwnerships.tenantId, tenantId), eq(propertyOwnerships.propertyId, propertyId),
      )).orderBy(asc(propertyOwnerships.createdAt), asc(propertyOwnerships.ownerId));
      return rows.map(toOwnership);
    }));
  }

  removeAtomically(tenantId: string, propertyId: string, ownerId: string): Promise<RemovePropertyOwnershipResult> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (property === undefined) return "PROPERTY_NOT_FOUND";
      const removed = await scope.database().delete(propertyOwnerships).where(and(
        eq(propertyOwnerships.tenantId, tenantId), eq(propertyOwnerships.propertyId, propertyId),
        eq(propertyOwnerships.ownerId, ownerId),
      )).returning({ ownerId: propertyOwnerships.ownerId });
      return removed.length === 0 ? "OWNERSHIP_NOT_FOUND" : "REMOVED";
    }));
  }

  private async persistence<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof PropertyOwnershipShareExceededError) throw error;
      throw new PropertyOwnershipPersistenceFailureError();
    }
  }
}

type PropertyOwnershipRow = typeof propertyOwnerships.$inferSelect;
function toOwnership(row: PropertyOwnershipRow): PropertyOwnership {
  return PropertyOwnership.rehydrate({
    tenantId: row.tenantId, propertyId: row.propertyId, ownerId: row.ownerId,
    ownershipShare: row.ownershipShare, createdAt: new Date(row.createdAt).toISOString(),
    correlationId: row.correlationId, actorId: row.actorId,
  });
}
