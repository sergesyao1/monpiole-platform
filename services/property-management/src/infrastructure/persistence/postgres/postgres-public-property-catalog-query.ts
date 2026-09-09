import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";

import type {
  PublicPropertyCatalogCriteria,
  PublicPropertyCatalogDetail,
  PublicPropertyCatalogItem,
  PublicPropertyCatalogPage,
  PublicPropertyCatalogQuery,
  PublicPropertyCommercialTerms,
  PublicPropertyDetails,
  PublicPropertyMediaReference,
  PublicPrimaryPhotoContent,
} from "../../../application/public-property-catalog-query.js";
import type {
  ApartmentSubtype,
  PropertyStructuralRole,
  PropertyType,
  TransactionType,
} from "../../../domain/property.js";

export class PostgresPublicPropertyCatalogQuery implements PublicPropertyCatalogQuery {
  constructor(private readonly pool: Pool) {}

  list(criteria: PublicPropertyCatalogCriteria): Promise<PublicPropertyCatalogPage> {
    return withTenantPostgresTransaction(this.pool, criteria.tenantId, async (scope) => {
      const values: unknown[] = [criteria.tenantId];
      const filters = ["p.tenant_id = $1::uuid", "p.status = 'PUBLISHED'"];
      if (criteria.propertyType !== undefined) {
        values.push(criteria.propertyType);
        filters.push(`p.property_type = $${values.length}`);
      }
      if (criteria.transactionType !== undefined) {
        values.push(criteria.transactionType);
        filters.push(`p.transaction_type = $${values.length}`);
      }
      if (criteria.cursor !== undefined) {
        values.push(criteria.cursor.publishedAt, criteria.cursor.publicPropertyId);
        filters.push(`(p.published_at, p.property_id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
      }
      values.push(criteria.limit + 1);

      const rows = await scope.query<PublicPropertyRow>(`
        SELECT ${PUBLIC_PROPERTY_COLUMNS}
        FROM property_management.properties AS p
        LEFT JOIN property_management.property_photos AS ph
          ON ph.tenant_id = p.tenant_id
          AND ph.property_id = p.property_id
          AND ph.status = 'AVAILABLE'
          AND ph.is_primary = TRUE
          AND ph.content_base64 IS NOT NULL
          AND ph.content_type IS NOT NULL
          AND ph.content_byte_size IS NOT NULL
          AND ph.content_sha256 IS NOT NULL
        WHERE ${filters.join(" AND ")}
        ORDER BY p.published_at DESC, p.property_id DESC
        LIMIT $${values.length}
      `, values);

      const hasNextPage = rows.length > criteria.limit;
      const items = rows.slice(0, criteria.limit).map(toCatalogItem);
      const last = hasNextPage ? items.at(-1) : undefined;
      return {
        items,
        ...(last === undefined
          ? {}
          : { nextCursor: { publishedAt: last.publishedAt, publicPropertyId: last.publicPropertyId } }),
      };
    });
  }

  retrieve(tenantId: string, publicPropertyId: string): Promise<PublicPropertyCatalogDetail | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<PublicPropertyRow>(`
        SELECT ${PUBLIC_PROPERTY_COLUMNS}
        FROM property_management.properties AS p
        LEFT JOIN property_management.property_photos AS ph
          ON ph.tenant_id = p.tenant_id
          AND ph.property_id = p.property_id
          AND ph.status = 'AVAILABLE'
          AND ph.is_primary = TRUE
          AND ph.content_base64 IS NOT NULL
          AND ph.content_type IS NOT NULL
          AND ph.content_byte_size IS NOT NULL
          AND ph.content_sha256 IS NOT NULL
        WHERE p.tenant_id = $1::uuid
          AND p.property_id = $2::uuid
          AND p.status = 'PUBLISHED'
        LIMIT 1
      `, [tenantId, publicPropertyId]);
      const row = rows[0];
      if (row === undefined) return undefined;
      const galleryRows = await scope.query<PublicMediaRow>(`
        SELECT ph.photo_id, ph.media_kind, ph.category, ph.gallery_position, ph.is_primary, ph.content_type
        FROM property_management.property_photos AS ph
        WHERE ph.tenant_id = $1::uuid
          AND ph.property_id = $2::uuid
          AND ph.status = 'AVAILABLE'
          AND ph.media_kind = 'IMAGE'
          AND ph.gallery_position IS NOT NULL
          AND ph.content_base64 IS NOT NULL
          AND ph.content_type IS NOT NULL
          AND ph.content_byte_size IS NOT NULL
          AND ph.content_sha256 IS NOT NULL
        ORDER BY ph.gallery_position, ph.photo_id
      `, [tenantId, publicPropertyId]);
      const amenities = await scope.query<{ code: PublicPropertyCatalogDetail["amenities"][number]["code"]; category: PublicPropertyCatalogDetail["amenities"][number]["category"]; label_fr: string; display_order: number }>(`
        SELECT code, category, label_fr, display_order FROM property_management.public_property_amenities
        WHERE property_id=$1::uuid ORDER BY category,display_order
      `, [publicPropertyId]);
      return {
        ...toCatalogItem(row), description: row.description, details: toDetails(row),
        gallery: galleryRows.map(toPublicMediaReference),
        amenities: amenities.map((amenity) => ({ code: amenity.code, category: amenity.category, labelFr: amenity.label_fr, displayOrder: amenity.display_order })),
      };
    });
  }

  retrievePrimaryPhoto(tenantId: string, publicPropertyId: string): Promise<PublicPrimaryPhotoContent | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<PublicPhotoRow>(`
        SELECT ph.content_base64, ph.content_type, ph.content_byte_size, ph.content_sha256
        FROM property_management.property_photos AS ph
        INNER JOIN property_management.properties AS p
          ON p.tenant_id = ph.tenant_id AND p.property_id = ph.property_id
        WHERE p.tenant_id = $1::uuid
          AND p.property_id = $2::uuid
          AND p.status = 'PUBLISHED'
          AND ph.status = 'AVAILABLE'
          AND ph.is_primary = TRUE
          AND ph.content_base64 IS NOT NULL
          AND ph.content_type IS NOT NULL
          AND ph.content_byte_size IS NOT NULL
          AND ph.content_sha256 IS NOT NULL
        LIMIT 1
      `, [tenantId, publicPropertyId]);
      const row = rows[0];
      if (row === undefined) return undefined;
      return {
        content: Buffer.from(row.content_base64, "base64"),
        contentType: row.content_type,
        contentByteSize: Number(row.content_byte_size),
        contentSha256: row.content_sha256,
      };
    });
  }


  retrieveMedia(tenantId: string, publicPropertyId: string, mediaId: string): Promise<PublicPrimaryPhotoContent | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<PublicPhotoRow>(`
        SELECT ph.content_base64, ph.content_type, ph.content_byte_size, ph.content_sha256
        FROM property_management.property_photos AS ph
        INNER JOIN property_management.properties AS p
          ON p.tenant_id = ph.tenant_id AND p.property_id = ph.property_id
        WHERE p.tenant_id = $1::uuid
          AND p.property_id = $2::uuid
          AND p.status = 'PUBLISHED'
          AND ph.photo_id = $3::uuid
          AND ph.status = 'AVAILABLE'
          AND ph.media_kind = 'IMAGE'
          AND ph.gallery_position IS NOT NULL
          AND ph.content_base64 IS NOT NULL
          AND ph.content_type IS NOT NULL
          AND ph.content_byte_size IS NOT NULL
          AND ph.content_sha256 IS NOT NULL
        LIMIT 1
      `, [tenantId, publicPropertyId, mediaId]);
      return rows[0] === undefined ? undefined : toPublicContent(rows[0]);
    });
  }
}

const PUBLIC_PROPERTY_COLUMNS = `
  p.property_id, p.title, p.description, p.property_type, p.transaction_type,
  p.apartment_subtype, p.structural_role, p.country, p.city, p.district,
  p.usable_surface_square_meters, p.rooms, p.bedrooms, p.bathrooms, p.furnished,
  p.commercial_kind, p.currency, p.rent_amount_minor, p.rent_period,
  p.security_deposit_amount_minor, p.charges_amount_minor, p.rate_amount_minor,
  p.pricing_unit, p.sale_price_amount_minor, p.agency_fee_amount_minor,
  p.cleaning_fee_amount_minor, p.minimum_stay_nights, p.published_at,
  ph.content_type AS primary_photo_content_type
`;

interface PublicPropertyRow extends Record<string, unknown> {
  readonly property_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly property_type: PropertyType;
  readonly transaction_type: TransactionType;
  readonly apartment_subtype: ApartmentSubtype | null;
  readonly structural_role: PropertyStructuralRole;
  readonly country: string;
  readonly city: string;
  readonly district: string;
  readonly usable_surface_square_meters: number | null;
  readonly rooms: number | null;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly furnished: boolean | null;
  readonly commercial_kind: PublicPropertyCommercialTerms["kind"];
  readonly currency: string;
  readonly rent_amount_minor: string | null;
  readonly rent_period: "MONTH" | null;
  readonly security_deposit_amount_minor: string | null;
  readonly charges_amount_minor: string | null;
  readonly rate_amount_minor: string | null;
  readonly pricing_unit: "NIGHT" | "WEEK" | null;
  readonly sale_price_amount_minor: string | null;
  readonly agency_fee_amount_minor: string | null;
  readonly cleaning_fee_amount_minor: string | null;
  readonly minimum_stay_nights: number | null;
  readonly published_at: string;
  readonly primary_photo_content_type: "image/jpeg" | "image/png" | "image/webp" | null;
}

interface PublicPhotoRow extends Record<string, unknown> {
  readonly content_base64: string;
  readonly content_type: "image/jpeg" | "image/png" | "image/webp";
  readonly content_byte_size: string;
  readonly content_sha256: string;
}

interface PublicMediaRow extends Record<string, unknown> {
  readonly photo_id: string;
  readonly media_kind: "IMAGE";
  readonly category: PublicPropertyMediaReference["category"];
  readonly gallery_position: number;
  readonly is_primary: boolean;
  readonly content_type: PublicPropertyMediaReference["contentType"];
}

function toPublicMediaReference(row: PublicMediaRow): PublicPropertyMediaReference {
  return {
    mediaId: row.photo_id, kind: row.media_kind, category: row.category,
    position: row.gallery_position, isPrimary: row.is_primary, contentType: row.content_type,
  };
}

function toPublicContent(row: PublicPhotoRow): PublicPrimaryPhotoContent {
  return {
    content: Buffer.from(row.content_base64, "base64"), contentType: row.content_type,
    contentByteSize: Number(row.content_byte_size), contentSha256: row.content_sha256,
  };
}

function toCatalogItem(row: PublicPropertyRow): PublicPropertyCatalogItem {
  return {
    publicPropertyId: row.property_id,
    title: row.title,
    propertyType: row.property_type,
    transactionType: row.transaction_type,
    ...(row.apartment_subtype === null ? {} : { apartmentSubtype: row.apartment_subtype }),
    structuralRole: row.structural_role,
    location: { country: row.country, city: row.city, district: row.district },
    commercialTerms: toCommercialTerms(row),
    primaryPhoto: row.primary_photo_content_type === null ? null : { contentType: row.primary_photo_content_type },
    publishedAt: new Date(row.published_at).toISOString(),
  };
}

function toDetails(row: PublicPropertyRow): PublicPropertyDetails {
  return {
    ...(row.usable_surface_square_meters === null ? {} : { usableSurfaceSquareMeters: row.usable_surface_square_meters }),
    ...(row.rooms === null ? {} : { rooms: row.rooms }),
    ...(row.bedrooms === null ? {} : { bedrooms: row.bedrooms }),
    ...(row.bathrooms === null ? {} : { bathrooms: row.bathrooms }),
    ...(row.furnished === null ? {} : { furnished: row.furnished }),
  };
}

function toCommercialTerms(row: PublicPropertyRow): PublicPropertyCommercialTerms {
  if (row.commercial_kind === "LONG_TERM_RENTAL") {
    return {
      kind: row.commercial_kind,
      currency: row.currency,
      rentAmountMinor: Number(row.rent_amount_minor),
      rentPeriod: "MONTH",
      ...(row.security_deposit_amount_minor === null
        ? {}
        : { securityDepositAmountMinor: Number(row.security_deposit_amount_minor) }),
      ...(row.charges_amount_minor === null ? {} : { chargesAmountMinor: Number(row.charges_amount_minor) }),
      ...(row.agency_fee_amount_minor === null ? {} : { agencyFeeAmountMinor: Number(row.agency_fee_amount_minor) }),
    };
  }
  if (row.commercial_kind === "SHORT_TERM_RENTAL") {
    return {
      kind: row.commercial_kind,
      currency: row.currency,
      rateAmountMinor: Number(row.rate_amount_minor),
      pricingUnit: row.pricing_unit!,
      ...(row.cleaning_fee_amount_minor === null ? {} : { cleaningFeeAmountMinor: Number(row.cleaning_fee_amount_minor) }),
      ...(row.security_deposit_amount_minor === null
        ? {}
        : { securityDepositAmountMinor: Number(row.security_deposit_amount_minor) }),
      ...(row.minimum_stay_nights === null ? {} : { minimumStayNights: row.minimum_stay_nights }),
    };
  }
  return {
    kind: "SALE",
    currency: row.currency,
    salePriceAmountMinor: Number(row.sale_price_amount_minor),
    ...(row.agency_fee_amount_minor === null ? {} : { agencyFeeAmountMinor: Number(row.agency_fee_amount_minor) }),
  };
}
