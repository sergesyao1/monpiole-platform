import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyPhotoStandardRepository,
  PropertyPhotoStandardTrace,
} from "../../../application/property-photo-standard-repository.js";
import {
  validatePropertyPhotoStandardOverride,
  type PropertyPhotoCategory,
  type PropertyPhotoStandardOverride,
} from "../../../domain/property-photo.js";
import { propertyPhotoStandards } from "./schema.js";

export class PostgresPropertyPhotoStandardRepository implements PropertyPhotoStandardRepository {
  constructor(private readonly pool: Pool) {}

  retrieve(tenantId: string): Promise<PropertyPhotoStandardOverride | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(propertyPhotoStandards).where(
        eq(propertyPhotoStandards.tenantId, tenantId),
      ).limit(1))[0];
      return row === undefined ? undefined : validatePropertyPhotoStandardOverride({
        minimumCount: row.minimumPhotoCount,
        additionalRequiredCategories: row.additionalRequiredCategories as PropertyPhotoCategory[],
      });
    });
  }

  save(
    tenantId: string,
    standard: PropertyPhotoStandardOverride,
    trace: PropertyPhotoStandardTrace,
  ): Promise<void> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      await scope.database().insert(propertyPhotoStandards).values({
        tenantId, minimumPhotoCount: standard.minimumCount,
        additionalRequiredCategories: [...standard.additionalRequiredCategories],
        updatedAt: trace.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
      }).onConflictDoUpdate({
        target: propertyPhotoStandards.tenantId,
        set: {
          minimumPhotoCount: standard.minimumCount,
          additionalRequiredCategories: [...standard.additionalRequiredCategories],
          updatedAt: trace.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
        },
      });
    });
  }
}
