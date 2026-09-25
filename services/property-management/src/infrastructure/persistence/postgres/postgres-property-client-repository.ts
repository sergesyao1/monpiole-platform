import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, desc, eq, ilike, lt, or, type SQL } from "drizzle-orm";
import type { Pool } from "pg";

import {
  PropertyClientPersistenceFailureError,
  type PropertyClientDirectoryCriteria,
  type PropertyClientDirectoryPage,
  type PropertyClientRepository,
} from "../../../application/property-client-repository.js";
import { PropertyClient } from "../../../domain/property-client.js";
import { propertyClients } from "./schema.js";

export class PostgresPropertyClientRepository implements PropertyClientRepository {
  constructor(private readonly pool: Pool) {}

  save(client: PropertyClient, correlationId: string, actorId: string): Promise<void> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, client.values.tenantId, async (scope) => {
      await scope.database().insert(propertyClients).values({
        ...client.values,
        email: client.values.email ?? null,
        phoneNumber: client.values.phoneNumber ?? null,
        correlationId,
        actorId,
      });
    }));
  }

  findById(tenantId: string, clientId: string): Promise<PropertyClient | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(propertyClients).where(and(
        eq(propertyClients.tenantId, tenantId), eq(propertyClients.clientId, clientId),
      )).limit(1))[0];
      return row === undefined ? undefined : toClient(row);
    }));
  }

  list(criteria: PropertyClientDirectoryCriteria): Promise<PropertyClientDirectoryPage> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, criteria.tenantId, async (scope) => {
      const filters: SQL[] = [eq(propertyClients.tenantId, criteria.tenantId)];
      if (criteria.search !== undefined) {
        const pattern = `%${escapeLikePattern(criteria.search)}%`;
        filters.push(or(
          ilike(propertyClients.displayName, pattern),
          ilike(propertyClients.email, pattern),
          ilike(propertyClients.phoneNumber, pattern),
        )!);
      }
      if (criteria.cursor !== undefined) filters.push(or(
        lt(propertyClients.createdAt, criteria.cursor.createdAt),
        and(eq(propertyClients.createdAt, criteria.cursor.createdAt), lt(propertyClients.clientId, criteria.cursor.clientId)),
      )!);
      const rows = await scope.database().select().from(propertyClients).where(and(...filters))
        .orderBy(desc(propertyClients.createdAt), desc(propertyClients.clientId)).limit(criteria.limit + 1);
      const items = rows.slice(0, criteria.limit).map(toClient);
      const last = rows.length > criteria.limit ? items.at(-1) : undefined;
      return {
        items,
        ...(last === undefined ? {} : {
          nextCursor: { createdAt: last.values.createdAt, clientId: last.values.clientId },
        }),
      };
    }));
  }

  private async persistence<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch { throw new PropertyClientPersistenceFailureError(); }
  }
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

type ClientRow = typeof propertyClients.$inferSelect;
export function toClient(row: ClientRow): PropertyClient {
  return PropertyClient.rehydrate({
    clientId: row.clientId,
    tenantId: row.tenantId,
    displayName: row.displayName,
    ...(row.email === null ? {} : { email: row.email }),
    ...(row.phoneNumber === null ? {} : { phoneNumber: row.phoneNumber }),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  });
}
