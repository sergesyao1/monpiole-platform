import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, desc, eq, ilike, lt, or, type SQL } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyOwnerDirectoryCriteria, PropertyOwnerDirectoryItem, PropertyOwnerDirectoryPage,
  PropertyOwnerDirectoryQuery,
} from "../../../application/property-owner-directory-query.js";
import { propertyOwners } from "./schema.js";

export class PostgresPropertyOwnerDirectoryQuery implements PropertyOwnerDirectoryQuery {
  constructor(private readonly pool: Pool) {}

  list(criteria: PropertyOwnerDirectoryCriteria): Promise<PropertyOwnerDirectoryPage> {
    return withTenantPostgresTransaction(this.pool, criteria.tenantId, async (scope) => {
      const filters: SQL[] = [eq(propertyOwners.tenantId, criteria.tenantId)];
      if (criteria.search !== undefined) {
        const pattern = `%${escapeLikePattern(criteria.search)}%`;
        filters.push(or(
          ilike(propertyOwners.firstName, pattern), ilike(propertyOwners.lastName, pattern),
          ilike(propertyOwners.legalName, pattern), ilike(propertyOwners.registrationNumber, pattern),
          ilike(propertyOwners.email, pattern),
        )!);
      }
      if (criteria.cursor !== undefined) filters.push(or(
        lt(propertyOwners.createdAt, criteria.cursor.createdAt),
        and(eq(propertyOwners.createdAt, criteria.cursor.createdAt), lt(propertyOwners.ownerId, criteria.cursor.ownerId)),
      )!);

      const rows = await scope.database().select().from(propertyOwners).where(and(...filters))
        .orderBy(desc(propertyOwners.createdAt), desc(propertyOwners.ownerId)).limit(criteria.limit + 1);
      const hasNextPage = rows.length > criteria.limit;
      const items = rows.slice(0, criteria.limit).map(toDirectoryItem);
      const last = hasNextPage ? items.at(-1) : undefined;
      return { items, ...(last === undefined ? {} : { nextCursor: { createdAt: last.createdAt, ownerId: last.ownerId } }) };
    });
  }
}

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

type OwnerRow = typeof propertyOwners.$inferSelect;
function toDirectoryItem(row: OwnerRow): PropertyOwnerDirectoryItem {
  const identity = row.ownerType === "INDIVIDUAL"
    ? { ownerType: "INDIVIDUAL" as const, firstName: row.firstName!, lastName: row.lastName! }
    : {
        ownerType: "LEGAL_ENTITY" as const, legalName: row.legalName!,
        ...(row.registrationNumber === null ? {} : { registrationNumber: row.registrationNumber }),
      };
  return {
    ownerId: row.ownerId, identity,
    contactInformation: {
      ...(row.phoneNumber === null ? {} : { phoneNumber: row.phoneNumber }),
      ...(row.email === null ? {} : { email: row.email }),
    },
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
