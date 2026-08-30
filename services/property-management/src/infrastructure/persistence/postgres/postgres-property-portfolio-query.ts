import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, desc, eq, ilike, lt, or, type SQL } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyPortfolioCriteria, PropertyPortfolioItem, PropertyPortfolioPage, PropertyPortfolioQuery,
} from "../../../application/property-portfolio-query.js";
import type { PropertyStatus, PropertyStructuralRole, PropertyType, TransactionType } from "../../../domain/property.js";
import { properties } from "./schema.js";

export class PostgresPropertyPortfolioQuery implements PropertyPortfolioQuery {
  constructor(private readonly pool: Pool) {}

  list(criteria: PropertyPortfolioCriteria): Promise<PropertyPortfolioPage> {
    return withTenantPostgresTransaction(this.pool, criteria.tenantId, async (scope) => {
      const filters: SQL[] = [eq(properties.tenantId, criteria.tenantId)];
      if (criteria.status !== undefined) filters.push(eq(properties.status, criteria.status));
      if (criteria.propertyType !== undefined) filters.push(eq(properties.propertyType, criteria.propertyType));
      if (criteria.search !== undefined) {
        const pattern = `%${escapeLikePattern(criteria.search)}%`;
        filters.push(or(
          ilike(properties.title, pattern), ilike(properties.description, pattern), ilike(properties.city, pattern),
          ilike(properties.district, pattern), ilike(properties.addressLine, pattern),
        )!);
      }
      if (criteria.cursor !== undefined) filters.push(or(
        lt(properties.createdAt, criteria.cursor.createdAt),
        and(eq(properties.createdAt, criteria.cursor.createdAt), lt(properties.propertyId, criteria.cursor.propertyId)),
      )!);

      const rows = await scope.database().select({
        propertyId: properties.propertyId, title: properties.title, description: properties.description,
        propertyType: properties.propertyType, transactionType: properties.transactionType,
        apartmentSubtype: properties.apartmentSubtype, status: properties.status,
        structuralRole: properties.structuralRole,
        country: properties.country, city: properties.city, district: properties.district, addressLine: properties.addressLine,
        createdAt: properties.createdAt, updatedAt: properties.updatedAt, publishedAt: properties.publishedAt,
      }).from(properties).where(and(...filters)).orderBy(desc(properties.createdAt), desc(properties.propertyId)).limit(criteria.limit + 1);

      const hasNextPage = rows.length > criteria.limit;
      const items = rows.slice(0, criteria.limit).map(toPortfolioItem);
      const last = hasNextPage ? items.at(-1) : undefined;
      return {
        items,
        ...(last === undefined ? {} : { nextCursor: { createdAt: last.createdAt, propertyId: last.propertyId } }),
      };
    });
  }
}

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

type PortfolioRow = {
  readonly propertyId: string; readonly title: string; readonly description: string | null;
  readonly propertyType: string; readonly transactionType: string; readonly apartmentSubtype: string | null; readonly status: string;
  readonly structuralRole: string;
  readonly country: string; readonly city: string; readonly district: string; readonly addressLine: string;
  readonly createdAt: string; readonly updatedAt: string; readonly publishedAt: string | null;
};
function toPortfolioItem(row: PortfolioRow): PropertyPortfolioItem {
  return {
    propertyId: row.propertyId, title: row.title,
    ...(row.description === null ? {} : { description: row.description }),
    propertyType: row.propertyType as PropertyType, transactionType: row.transactionType as TransactionType,
    ...(row.apartmentSubtype === null ? {} : { apartmentSubtype: row.apartmentSubtype as "STUDIO" | "MULTI_ROOM" }),
    status: row.status as PropertyStatus,
    structuralRole: row.structuralRole as PropertyStructuralRole,
    location: { country: row.country, city: row.city, district: row.district, addressLine: row.addressLine },
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
    ...(row.publishedAt === null ? {} : { publishedAt: new Date(row.publishedAt).toISOString() }),
  };
}
