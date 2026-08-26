import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

import type { PropertyRepository } from "../../../application/property-repository.js";
import { Property, type PropertyStatus, type PropertyType, type TransactionType } from "../../../domain/property.js";
import { properties } from "./schema.js";

export class PostgresPropertyRepository implements PropertyRepository {
  constructor(private readonly pool: Pool) {}
  save(property: Property, correlationId: string, actorId: string): Promise<void> {
    return withTenantPostgresTransaction(this.pool, property.values.tenantId, async (scope) => {
      const value = property.values;
      await scope.database().insert(properties).values({
        propertyId: value.propertyId, tenantId: value.tenantId, title: value.title,
        description: value.description, propertyType: value.propertyType,
        transactionType: value.transactionType, status: value.status,
        country: value.location.country, city: value.location.city, district: value.location.district,
        addressLine: value.location.addressLine, createdAt: value.createdAt, updatedAt: value.updatedAt,
        correlationId, actorId,
      });
    });
  }
  findById(tenantId: string, propertyId: string): Promise<Property | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1))[0];
      if (row === undefined) return undefined;
      return Property.rehydrate({
        propertyId: row.propertyId, tenantId: row.tenantId, title: row.title,
        ...(row.description === null ? {} : { description: row.description }),
        propertyType: row.propertyType as PropertyType, transactionType: row.transactionType as TransactionType,
        status: row.status as PropertyStatus,
        location: { country: row.country, city: row.city, district: row.district, addressLine: row.addressLine },
        createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
      });
    });
  }
}
