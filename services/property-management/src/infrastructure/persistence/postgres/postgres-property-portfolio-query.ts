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
      const summaryRootIds = pageRows
        .filter((row) => row.propertyType === "BUILDING" || row.propertyType === "COMPLEX")
        .map((row) => row.propertyId);

      const contentSummaryRows = summaryRootIds.length === 0 ? [] : await scope.query<{
        root_id: string;
        row_kind: "COMPOSITION" | "AVAILABILITY";
        property_type: string | null;
        building_count: number;
        total_count: number;
        configured_count: number;
        available_count: number;
        unavailable_count: number;
        vacant_count: number;
        occupied_count: number;
        contract_total_count: number;
        contract_active_count: number;
      }>(`
        WITH requested_roots AS (
          SELECT unnest($2::uuid[]) AS root_id
        ),
        root_properties AS (
          SELECT
            p.property_id AS root_id,
            p.property_type,
            p.commercialization_mode
          FROM property_management.properties p
          JOIN requested_roots requested
            ON requested.root_id = p.property_id
          WHERE p.tenant_id = $1::uuid
        ),

        /*
         * Structural Buildings belonging to each requested root.
         *
         * For a BUILDING root this identifies its structural Building row.
         * For a COMPLEX root this identifies its direct Buildings.
         */
        descendant_buildings AS (
          SELECT
            root.root_id,
            building.building_id,
            building.building_property_id,
            building_property.commercialization_mode,
            root.property_type AS root_property_type,
            root.commercialization_mode AS root_commercialization_mode
          FROM root_properties root
          JOIN property_management.property_buildings building
            ON building.tenant_id = $1::uuid
           AND (
             building.building_property_id = root.root_id
             OR (
               root.property_type = 'COMPLEX'
               AND building.property_id = root.root_id
             )
           )
          LEFT JOIN property_management.properties building_property
            ON building_property.tenant_id = building.tenant_id
           AND building_property.property_id = building.building_property_id
        ),

        /*
         * Physical units are independent from commercialization mode.
         *
         * A WHOLE_BUILDING therefore still exposes the Apartments, Offices,
         * Shops, etc. that physically compose it.
         */
        physical_building_units AS (
          SELECT DISTINCT
            building.root_id,
            unit.property_id AS target_property_id
          FROM descendant_buildings building
          JOIN property_management.property_building_units relation
            ON relation.tenant_id = $1::uuid
           AND relation.building_id = building.building_id
          JOIN property_management.properties unit
            ON unit.tenant_id = relation.tenant_id
           AND unit.property_id = relation.unit_property_id
        ),

        /*
         * Direct non-Building children of a Complex are also physical content:
         * villas, apartments, offices, shops, etc.
         */
        direct_complex_children AS (
          SELECT DISTINCT
            root.root_id,
            child.property_id AS target_property_id
          FROM root_properties root
          JOIN property_management.property_complex_children relation
            ON relation.tenant_id = $1::uuid
           AND relation.complex_property_id = root.root_id
          JOIN property_management.properties child
            ON child.tenant_id = relation.tenant_id
           AND child.property_id = relation.child_property_id
          WHERE root.property_type = 'COMPLEX'
            AND child.property_type <> 'BUILDING'
        ),

        composition_targets AS (
          SELECT root_id, target_property_id
          FROM physical_building_units

          UNION

          SELECT root_id, target_property_id
          FROM direct_complex_children
        ),

        composition_details AS (
          SELECT
            target.root_id,
            property.property_id,
            property.property_type
          FROM composition_targets target
          JOIN property_management.properties property
            ON property.tenant_id = $1::uuid
           AND property.property_id = target.target_property_id
        ),

        building_stats AS (
          SELECT
            root.root_id,
            CASE
              WHEN root.property_type = 'COMPLEX'
              THEN count(DISTINCT building.building_id)::int
              ELSE 0
            END AS building_count
          FROM root_properties root
          LEFT JOIN descendant_buildings building
            ON building.root_id = root.root_id
          GROUP BY root.root_id, root.property_type
        ),

        composition_stats AS (
          SELECT
            root.root_id,
            detail.property_type,
            count(detail.property_id)::int AS total_count
          FROM root_properties root
          LEFT JOIN composition_details detail
            ON detail.root_id = root.root_id
          GROUP BY root.root_id, detail.property_type
        ),

        /*
         * Commercial targets intentionally differ from physical composition.
         *
         * INDIVIDUAL_UNITS -> child units are commercial targets.
         * WHOLE_BUILDING   -> canonical Building Property is the target.
         * COMPLEX          -> direct non-Building children are targets.
         */
        individual_building_units AS (
          SELECT DISTINCT
            building.root_id,
            unit.property_id AS target_property_id
          FROM descendant_buildings building
          JOIN property_management.property_building_units relation
            ON relation.tenant_id = $1::uuid
           AND relation.building_id = building.building_id
          JOIN property_management.properties unit
            ON unit.tenant_id = relation.tenant_id
           AND unit.property_id = relation.unit_property_id
          WHERE (
            building.root_property_type = 'BUILDING'
            AND building.building_property_id = building.root_id
            AND building.root_commercialization_mode = 'INDIVIDUAL_UNITS'
          )
          OR (
            building.root_property_type = 'COMPLEX'
            AND building.commercialization_mode = 'INDIVIDUAL_UNITS'
          )
        ),

        whole_building_targets AS (
          SELECT
            root.root_id,
            root.root_id AS target_property_id
          FROM root_properties root
          WHERE root.property_type = 'BUILDING'
            AND root.commercialization_mode = 'WHOLE_BUILDING'

          UNION

          SELECT
            building.root_id,
            building.building_property_id AS target_property_id
          FROM descendant_buildings building
          WHERE building.root_property_type = 'COMPLEX'
            AND building.building_property_id IS NOT NULL
            AND building.building_property_id <> building.root_id
            AND building.commercialization_mode = 'WHOLE_BUILDING'
        ),

        commercial_targets AS (
          SELECT root_id, target_property_id
          FROM individual_building_units

          UNION

          SELECT root_id, target_property_id
          FROM whole_building_targets

          UNION

          SELECT root_id, target_property_id
          FROM direct_complex_children
        ),

        commercial_details AS (
          SELECT
            target.root_id,
            property.property_id,
            property.property_type,
            property.availability_status,
            property.occupancy_status
          FROM commercial_targets target
          JOIN property_management.properties property
            ON property.tenant_id = $1::uuid
           AND property.property_id = target.target_property_id
        ),

        availability_stats AS (
          SELECT
            root.root_id,
            detail.property_type,
            count(detail.property_id)::int AS total_count,
            count(detail.property_id)
              FILTER (
                WHERE detail.availability_status IS NOT NULL
                  AND detail.occupancy_status IS NOT NULL
              )::int AS configured_count,
            count(detail.property_id)
              FILTER (
                WHERE detail.availability_status = 'AVAILABLE'
              )::int AS available_count,
            count(detail.property_id)
              FILTER (
                WHERE detail.availability_status = 'UNAVAILABLE'
              )::int AS unavailable_count,
            count(detail.property_id)
              FILTER (
                WHERE detail.occupancy_status = 'VACANT'
              )::int AS vacant_count,
            count(detail.property_id)
              FILTER (
                WHERE detail.occupancy_status = 'OCCUPIED'
              )::int AS occupied_count
          FROM root_properties root
          LEFT JOIN commercial_details detail
            ON detail.root_id = root.root_id
          GROUP BY root.root_id, detail.property_type
        ),

        contract_stats AS (
          SELECT
            root.root_id,
            count(contract.contract_id)::int AS contract_total_count,
            count(contract.contract_id)
              FILTER (
                WHERE contract.status = 'ACTIVE'
              )::int AS contract_active_count
          FROM root_properties root
          LEFT JOIN commercial_targets target
            ON target.root_id = root.root_id
          LEFT JOIN property_management.property_contracts contract
            ON contract.tenant_id = $1::uuid
           AND contract.property_id = target.target_property_id
          GROUP BY root.root_id
        ),

        summary_rows AS (
          SELECT
            composition.root_id,
            'COMPOSITION'::text AS row_kind,
            composition.property_type,
            buildings.building_count,
            composition.total_count,
            0::int AS configured_count,
            0::int AS available_count,
            0::int AS unavailable_count,
            0::int AS vacant_count,
            0::int AS occupied_count,
            contracts.contract_total_count,
            contracts.contract_active_count
          FROM composition_stats composition
          JOIN building_stats buildings
            ON buildings.root_id = composition.root_id
          JOIN contract_stats contracts
            ON contracts.root_id = composition.root_id

          UNION ALL

          SELECT
            availability.root_id,
            'AVAILABILITY'::text AS row_kind,
            availability.property_type,
            buildings.building_count,
            availability.total_count,
            availability.configured_count,
            availability.available_count,
            availability.unavailable_count,
            availability.vacant_count,
            availability.occupied_count,
            contracts.contract_total_count,
            contracts.contract_active_count
          FROM availability_stats availability
          JOIN building_stats buildings
            ON buildings.root_id = availability.root_id
          JOIN contract_stats contracts
            ON contracts.root_id = availability.root_id
        )

        SELECT
          root_id,
          row_kind,
          property_type,
          building_count,
          total_count,
          configured_count,
          available_count,
          unavailable_count,
          vacant_count,
          occupied_count,
          contract_total_count,
          contract_active_count
        FROM summary_rows
        ORDER BY
          root_id,
          row_kind,
          property_type NULLS LAST
      `, [criteria.tenantId, summaryRootIds]);

      const contentSummaryByProperty = new Map<
        string,
        NonNullable<PropertyPortfolioItem["contentSummary"]>
      >();

      for (const row of contentSummaryRows) {
        const current = contentSummaryByProperty.get(row.root_id) ?? {
          buildingCount: row.building_count,
          composition: {
            totalUnitCount: 0,
            unitsByType: [],
          },
          availability: {
            totalCount: 0,
            configuredCount: 0,
            availableCount: 0,
            unavailableCount: 0,
            vacantCount: 0,
            occupiedCount: 0,
            byType: [],
          },
          contracts: {
            totalCount: row.contract_total_count,
            activeCount: row.contract_active_count,
          },
        };

        if (row.property_type === null) {
          contentSummaryByProperty.set(row.root_id, current);
          continue;
        }

        if (row.row_kind === "COMPOSITION") {
          contentSummaryByProperty.set(row.root_id, {
            ...current,
            buildingCount: row.building_count,
            composition: {
              totalUnitCount:
                current.composition.totalUnitCount + row.total_count,
              unitsByType: [
                ...current.composition.unitsByType,
                {
                  propertyType: row.property_type as PropertyType,
                  totalCount: row.total_count,
                },
              ],
            },
          });

          continue;
        }

        contentSummaryByProperty.set(row.root_id, {
          ...current,
          buildingCount: row.building_count,
          availability: {
            totalCount:
              current.availability.totalCount + row.total_count,
            configuredCount:
              current.availability.configuredCount + row.configured_count,
            availableCount:
              current.availability.availableCount + row.available_count,
            unavailableCount:
              current.availability.unavailableCount + row.unavailable_count,
            vacantCount:
              current.availability.vacantCount + row.vacant_count,
            occupiedCount:
              current.availability.occupiedCount + row.occupied_count,
            byType: [
              ...current.availability.byType,
              {
                propertyType: row.property_type as PropertyType,
                totalCount: row.total_count,
                configuredCount: row.configured_count,
                availableCount: row.available_count,
                unavailableCount: row.unavailable_count,
                vacantCount: row.vacant_count,
                occupiedCount: row.occupied_count,
              },
            ],
          },
        });
      }
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
        const contentSummary = contentSummaryByProperty.get(row.propertyId);
        const inherited = ownOwners.length > 0 ? undefined : [parent, grandparent].find((candidate) =>
          candidate !== undefined && (ownersByProperty.get(candidate.parent_id)?.length ?? 0) > 0);
        return { ...toPortfolioItem(
        row, photoByProperty.get(row.propertyId), photoCountByProperty.get(row.propertyId) ?? 0,
        inherited === undefined ? ownOwners : ownersByProperty.get(inherited.parent_id) ?? [],
        inherited === undefined ? undefined : { propertyId: inherited.parent_id, title: inherited.parent_title },
      ),
      ...(contentSummary === undefined ? {} : { contentSummary }),
      ...(parentByChild.get(row.propertyId) === undefined ? {} : { parent: {
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
