import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, count, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyPortfolioCriteria, PropertyPortfolioItem, PropertyPortfolioPage, PropertyPortfolioQuery,
} from "../../../application/property-portfolio-query.js";
import type { PropertyStatus, PropertyStructuralRole, PropertyType, TransactionType } from "../../../domain/property.js";
import { properties, propertyOwners, propertyOwnerships, propertyPhotos } from "./schema.js";

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
          sql`EXISTS (
            SELECT 1 FROM property_management.property_ownerships po
            JOIN property_management.property_owners owner
              ON owner.tenant_id = po.tenant_id AND owner.owner_id = po.owner_id
            WHERE po.tenant_id = ${criteria.tenantId}::uuid
              AND po.property_id = ${properties.propertyId}
              AND (owner.first_name ILIKE ${pattern} ESCAPE '\\' OR owner.last_name ILIKE ${pattern} ESCAPE '\\'
                OR owner.legal_name ILIKE ${pattern} ESCAPE '\\')
          )`,
        )!);
      }
      if (criteria.ownerId !== undefined) filters.push(sql`EXISTS (
        SELECT 1 FROM property_management.property_ownerships po
        WHERE po.tenant_id = ${criteria.tenantId}::uuid
          AND po.property_id = ${properties.propertyId}
          AND po.owner_id = ${criteria.ownerId}::uuid
      )`);
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
        withdrawnAt: properties.withdrawnAt,
      }).from(properties).where(and(...filters)).orderBy(desc(properties.createdAt), desc(properties.propertyId)).limit(criteria.limit + 1);

      const hasNextPage = rows.length > criteria.limit;
      const pageRows = rows.slice(0, criteria.limit);
      const propertyIds = pageRows.map((row) => row.propertyId);
      const parentRows = propertyIds.length === 0 ? [] : await scope.query<{
        child_id: string; parent_id: string; parent_title: string;
      }>(`
        SELECT relation.child_id, parent.property_id AS parent_id, parent.title AS parent_title
        FROM (
          SELECT child_property_id AS child_id, complex_property_id AS parent_id, tenant_id
          FROM property_management.property_complex_children
          UNION ALL
          SELECT building_property_id AS child_id, property_id AS parent_id, tenant_id
          FROM property_management.property_buildings
          WHERE building_property_id IS NOT NULL AND building_property_id<>property_id
          UNION ALL
          SELECT unit.unit_property_id AS child_id,
            coalesce(building.building_property_id, building.property_id) AS parent_id, unit.tenant_id
          FROM property_management.property_building_units unit
          JOIN property_management.property_buildings building
            ON building.tenant_id=unit.tenant_id AND building.building_id=unit.building_id
        ) relation
        JOIN property_management.properties parent
          ON parent.tenant_id=relation.tenant_id AND parent.property_id=relation.parent_id
        WHERE relation.tenant_id=$1::uuid AND relation.child_id=ANY($2::uuid[])
      `, [criteria.tenantId, propertyIds]);
      const parentByChild = new Map(parentRows.map((row) => [row.child_id, row]));
      const grandparentRows = propertyIds.length === 0 ? [] : await scope.query<{
        child_id: string; parent_id: string; parent_title: string;
      }>(`
        SELECT unit.unit_property_id AS child_id, parent.property_id AS parent_id, parent.title AS parent_title
        FROM property_management.property_building_units unit
        JOIN property_management.property_buildings building
          ON building.tenant_id=unit.tenant_id AND building.building_id=unit.building_id
        JOIN property_management.properties parent
          ON parent.tenant_id=building.tenant_id AND parent.property_id=building.property_id
        WHERE unit.tenant_id=$1::uuid AND unit.unit_property_id=ANY($2::uuid[])
          AND building.building_property_id IS NOT NULL AND building.property_id<>building.building_property_id
      `, [criteria.tenantId, propertyIds]);
      const grandparentByChild = new Map(grandparentRows.map((row) => [row.child_id, row]));
      const photoRows = propertyIds.length === 0 ? [] : await scope.database().select({
          propertyId: propertyPhotos.propertyId, photoId: propertyPhotos.photoId,
          contentType: propertyPhotos.contentType, contentBase64: propertyPhotos.contentBase64,
        }).from(propertyPhotos).where(and(
          eq(propertyPhotos.tenantId, criteria.tenantId), inArray(propertyPhotos.propertyId, propertyIds),
          eq(propertyPhotos.status, "AVAILABLE"), eq(propertyPhotos.isPrimary, true),
        ));
      const photoCountRows = propertyIds.length === 0 ? [] : await scope.database()
        .select({ propertyId: propertyPhotos.propertyId, photoCount: count() })
          .from(propertyPhotos).where(and(
            eq(propertyPhotos.tenantId, criteria.tenantId), inArray(propertyPhotos.propertyId, propertyIds),
            eq(propertyPhotos.status, "AVAILABLE"),
          )).groupBy(propertyPhotos.propertyId);
      const ownerCandidateIds = [...new Set([...propertyIds, ...parentRows.map((row) => row.parent_id), ...grandparentRows.map((row) => row.parent_id)])];
      const ownerRows = ownerCandidateIds.length === 0 ? [] : await scope.database().select({
          propertyId: propertyOwnerships.propertyId, ownerId: propertyOwners.ownerId,
          ownerType: propertyOwners.ownerType, firstName: propertyOwners.firstName,
          lastName: propertyOwners.lastName, legalName: propertyOwners.legalName,
          phoneNumber: propertyOwners.phoneNumber, email: propertyOwners.email,
        }).from(propertyOwnerships).innerJoin(propertyOwners, and(
          eq(propertyOwners.tenantId, propertyOwnerships.tenantId), eq(propertyOwners.ownerId, propertyOwnerships.ownerId),
        )).where(and(
          eq(propertyOwnerships.tenantId, criteria.tenantId), inArray(propertyOwnerships.propertyId, ownerCandidateIds),
        )).orderBy(asc(propertyOwnerships.createdAt), asc(propertyOwnerships.ownerId));
      const photoByProperty = new Map(photoRows.map((photo) => [photo.propertyId, photo]));
      const photoCountByProperty = new Map(photoCountRows.map((photo) => [photo.propertyId, photo.photoCount]));
      const ownersByProperty = new Map<string, typeof ownerRows>();
      for (const owner of ownerRows) ownersByProperty.set(owner.propertyId, [...(ownersByProperty.get(owner.propertyId) ?? []), owner]);
      const items = pageRows.map((row) => {
        const ownOwners = ownersByProperty.get(row.propertyId) ?? [];
        const parent = parentByChild.get(row.propertyId);
        const grandparent = grandparentByChild.get(row.propertyId);
        const inherited = ownOwners.length > 0 ? undefined : [parent, grandparent].find((candidate) =>
          candidate !== undefined && (ownersByProperty.get(candidate.parent_id)?.length ?? 0) > 0);
        return { ...toPortfolioItem(
        row, photoByProperty.get(row.propertyId), photoCountByProperty.get(row.propertyId) ?? 0,
        inherited === undefined ? ownOwners : ownersByProperty.get(inherited.parent_id) ?? [],
        inherited === undefined ? undefined : { propertyId: inherited.parent_id, title: inherited.parent_title },
      ), ...(parentByChild.get(row.propertyId) === undefined ? {} : { parent: {
        propertyId: parentByChild.get(row.propertyId)!.parent_id,
        title: parentByChild.get(row.propertyId)!.parent_title,
      } }) };
      });
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
  readonly createdAt: string; readonly updatedAt: string; readonly publishedAt: string | null; readonly withdrawnAt: string | null;
};
type FeaturedPhotoRow = { readonly photoId: string; readonly contentType: string | null; readonly contentBase64: string | null };
type OwnerRow = {
  readonly ownerId: string; readonly ownerType: string; readonly firstName: string | null; readonly lastName: string | null;
  readonly legalName: string | null; readonly phoneNumber: string | null; readonly email: string | null;
};
function toPortfolioItem(row: PortfolioRow, photo: FeaturedPhotoRow | undefined, photoCount: number, owners: readonly OwnerRow[], inheritedFrom?: { propertyId: string; title: string }): PropertyPortfolioItem {
  const primaryOwner = owners[0];
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
    ...(row.withdrawnAt === null ? {} : { withdrawnAt: new Date(row.withdrawnAt).toISOString() }),
    photoCount,
    ...(photo?.contentBase64 === null || photo?.contentType === null || photo === undefined ? {} : { featuredPhoto: {
      photoId: photo.photoId, contentType: photo.contentType as "image/jpeg" | "image/png" | "image/webp",
      contentBase64: photo.contentBase64,
    } }),
    ...(primaryOwner === undefined ? {} : { owner: {
      ownerId: primaryOwner.ownerId,
      displayName: primaryOwner.ownerType === "INDIVIDUAL"
        ? `${primaryOwner.firstName ?? ""} ${primaryOwner.lastName ?? ""}`.trim()
        : primaryOwner.legalName ?? "Propriétaire",
      ...(primaryOwner.phoneNumber === null ? {} : { phoneNumber: primaryOwner.phoneNumber }),
      ...(primaryOwner.email === null ? {} : { email: primaryOwner.email }),
      additionalOwnerCount: owners.length - 1,
      ...(inheritedFrom === undefined ? {} : { inheritedFrom }),
    } }),
  };
}
