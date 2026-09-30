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
      const add = (value: unknown): string => { values.push(value); return `$${values.length}`; };
      if (criteria.propertyType !== undefined) {
        filters.push(`p.property_type = ${add(criteria.propertyType)}`);
      }
      if (criteria.transactionType !== undefined) {
        filters.push(`p.transaction_type = ${add(criteria.transactionType)}`);
      }
      if (criteria.propertyTypes !== undefined) filters.push(`p.property_type = ANY(${add(criteria.propertyTypes)}::text[])`);
      if (criteria.transactionTypes !== undefined) filters.push(`p.transaction_type = ANY(${add(criteria.transactionTypes)}::text[])`);
      if (criteria.structuralRoles !== undefined) filters.push(`p.structural_role = ANY(${add(criteria.structuralRoles)}::text[])`);

      const country = effectiveGeography("country_code");
      const city = effectiveGeography("city");
      const commune = effectiveGeography("commune");
      const quartier = effectiveGeography("quartier");
      if (criteria.countryCode !== undefined) filters.push(`${country} = ${add(criteria.countryCode)}`);
      if (criteria.city !== undefined) filters.push(`lower(btrim(${city})) = lower(btrim(${add(criteria.city)}))`);
      if (criteria.commune !== undefined) filters.push(`lower(btrim(${commune})) = lower(btrim(${add(criteria.commune)}))`);
      if (criteria.quartier !== undefined) filters.push(`lower(btrim(${quartier})) = lower(btrim(${add(criteria.quartier)}))`);
      if (criteria.currencyCode !== undefined) filters.push(`p.currency = ${add(criteria.currencyCode)}`);
      if (criteria.minPriceAmountMinor !== undefined) filters.push(`${PRICE_EXPRESSION} >= ${add(criteria.minPriceAmountMinor)}::bigint`);
      if (criteria.maxPriceAmountMinor !== undefined) filters.push(`${PRICE_EXPRESSION} <= ${add(criteria.maxPriceAmountMinor)}::bigint`);
      if (criteria.minBedrooms !== undefined) filters.push(`p.bedrooms >= ${add(criteria.minBedrooms)}::integer`);
      if (criteria.maxBedrooms !== undefined) filters.push(`p.bedrooms <= ${add(criteria.maxBedrooms)}::integer`);
      if (criteria.q !== undefined) {
        const q = add(criteria.q);
        filters.push(`(p.title ILIKE '%' || ${q} || '%' OR p.description ILIKE '%' || ${q} || '%'
          OR ${city} ILIKE '%' || ${q} || '%' OR ${commune} ILIKE '%' || ${q} || '%' OR ${quartier} ILIKE '%' || ${q} || '%')`);
      }

      const sort = criteria.sort ?? "NEWEST";
      const priceSort = sort === "PRICE_ASC" || sort === "PRICE_DESC";
      if (criteria.cursor !== undefined) {
        if (priceSort) {
          const price = add(criteria.cursor.priceAmountMinor);
          const id = add(criteria.cursor.publicPropertyId);
          filters.push(`(${PRICE_EXPRESSION}, p.property_id) ${sort === "PRICE_ASC" ? ">" : "<"} (${price}::bigint, ${id}::uuid)`);
        } else {
          const publishedAt = add(criteria.cursor.publishedAt);
          const id = add(criteria.cursor.publicPropertyId);
          filters.push(`(p.published_at, p.property_id) < (${publishedAt}::timestamptz, ${id}::uuid)`);
        }
      }
      const limit = add(criteria.limit + 1);
      const orderBy = priceSort
        ? `${PRICE_EXPRESSION} ${sort === "PRICE_ASC" ? "ASC" : "DESC"}, p.property_id ${sort === "PRICE_ASC" ? "ASC" : "DESC"}`
        : "p.published_at DESC, p.property_id DESC";

      const rows = await scope.query<PublicPropertyRow>(`
        SELECT ${PUBLIC_PROPERTY_COLUMNS}, ${PRICE_EXPRESSION} AS effective_price_amount_minor,
          ${country} AS effective_country, ${city} AS effective_city,
          ${commune} AS effective_commune, ${quartier} AS effective_quartier
        FROM property_management.properties AS p
        ${EFFECTIVE_GEOGRAPHY_JOINS}
        ${EFFECTIVE_GEOLOCATION_JOINS}
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
          AND ${country} IS NOT NULL AND ${city} IS NOT NULL
        ORDER BY ${orderBy}
        LIMIT ${limit}
      `, values);

      const hasNextPage = rows.length > criteria.limit;
      const items = rows.slice(0, criteria.limit).map(toCatalogItem);
      const last = hasNextPage ? items.at(-1) : undefined;
      return {
        items,
        ...(last === undefined
          ? {}
          : { nextCursor: priceSort
            ? { publishedAt: last.publishedAt, publicPropertyId: last.publicPropertyId, sort, priceAmountMinor: priceOf(last) }
            : { publishedAt: last.publishedAt, publicPropertyId: last.publicPropertyId } }),
      };
    });
  }

  retrieve(tenantId: string, publicPropertyId: string): Promise<PublicPropertyCatalogDetail | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const rows = await scope.query<PublicPropertyRow>(`
        SELECT ${PUBLIC_PROPERTY_COLUMNS}, ${PRICE_EXPRESSION} AS effective_price_amount_minor,
          ${effectiveGeography("country_code")} AS effective_country,
          ${effectiveGeography("city")} AS effective_city,
          ${effectiveGeography("commune")} AS effective_commune,
          ${effectiveGeography("quartier")} AS effective_quartier
        FROM property_management.properties AS p
        ${EFFECTIVE_GEOGRAPHY_JOINS}
        ${EFFECTIVE_GEOLOCATION_JOINS}
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
  ,p.tenant_id,
  ${effectiveGeolocation("property_id")} AS effective_geolocation_property_id,
  ${effectiveGeolocation("latitude")} AS effective_latitude,
  ${effectiveGeolocation("longitude")} AS effective_longitude,
  ${effectiveGeolocation("public_visibility")} AS effective_public_visibility
`;

const PRICE_EXPRESSION = `CASE p.commercial_kind
  WHEN 'LONG_TERM_RENTAL' THEN p.rent_amount_minor
  WHEN 'SHORT_TERM_RENTAL' THEN p.rate_amount_minor
  WHEN 'SALE' THEN p.sale_price_amount_minor
END`;

const EFFECTIVE_GEOGRAPHY_JOINS = `
  LEFT JOIN property_management.property_geography_sources AS own_geo
    ON own_geo.tenant_id = p.tenant_id AND own_geo.property_id = p.property_id
  LEFT JOIN property_management.property_building_units AS bu
    ON bu.tenant_id = p.tenant_id AND bu.unit_property_id = p.property_id
  LEFT JOIN property_management.property_buildings AS b
    ON b.tenant_id = bu.tenant_id AND b.building_id = bu.building_id
  LEFT JOIN property_management.property_geography_sources AS building_geo
    ON building_geo.tenant_id = b.tenant_id AND building_geo.property_id = b.building_property_id
  LEFT JOIN property_management.property_complex_children AS direct_link
    ON direct_link.tenant_id = p.tenant_id AND direct_link.child_property_id = p.property_id
  LEFT JOIN property_management.property_geography_sources AS direct_complex_geo
    ON direct_complex_geo.tenant_id = direct_link.tenant_id AND direct_complex_geo.property_id = direct_link.complex_property_id
  LEFT JOIN property_management.property_geography_sources AS building_complex_geo
    ON building_complex_geo.tenant_id = b.tenant_id AND building_complex_geo.property_id = b.property_id`;

const EFFECTIVE_GEOLOCATION_JOINS = `
  LEFT JOIN property_management.public_property_geolocations AS effective_location
    ON effective_location.tenant_id = p.tenant_id AND effective_location.property_id = p.property_id`;

function effectiveGeography(field: "country_code" | "city" | "commune" | "quartier"): string {
  return `CASE WHEN own_geo.inherit_missing THEN COALESCE(own_geo.${field}, building_geo.${field}, direct_complex_geo.${field}, building_complex_geo.${field}) ELSE own_geo.${field} END`;
}

function effectiveGeolocation(field: "property_id" | "latitude" | "longitude" | "public_visibility"): string {
  return `effective_location.${field}`;
}

interface PublicPropertyRow extends Record<string, unknown> {
  readonly tenant_id: string;
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
  readonly effective_price_amount_minor: string;
  readonly effective_country: string;
  readonly effective_city: string;
  readonly effective_commune: string | null;
  readonly effective_quartier: string | null;
  readonly effective_geolocation_property_id: string | null;
  readonly effective_latitude: string | number | null;
  readonly effective_longitude: string | number | null;
  readonly effective_public_visibility: "EXACT" | "APPROXIMATE" | null;
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
  const publicLocation = toPublicLocation(row);
  return {
    publicPropertyId: row.property_id,
    title: row.title,
    propertyType: row.property_type,
    transactionType: row.transaction_type,
    ...(row.apartment_subtype === null ? {} : { apartmentSubtype: row.apartment_subtype }),
    structuralRole: row.structural_role,
    location: {
      country: row.effective_country,
      city: row.effective_city,
      district: row.effective_quartier ?? row.effective_commune ?? row.district,
    },
    publicLocation,
    commercialTerms: toCommercialTerms(row),
    primaryPhoto: row.primary_photo_content_type === null ? null : { contentType: row.primary_photo_content_type },
    publishedAt: new Date(row.published_at).toISOString(),
  };
}

function toPublicLocation(row: PublicPropertyRow): PublicPropertyCatalogItem["publicLocation"] {
  if (row.effective_geolocation_property_id === null || row.effective_latitude === null
    || row.effective_longitude === null || row.effective_public_visibility === null) return null;
  return {
    latitude: Number(row.effective_latitude),
    longitude: Number(row.effective_longitude),
    precision: row.effective_public_visibility,
  };
}

function priceOf(item: PublicPropertyCatalogItem): number {
  if (item.commercialTerms.kind === "SALE") return item.commercialTerms.salePriceAmountMinor;
  if (item.commercialTerms.kind === "LONG_TERM_RENTAL") return item.commercialTerms.rentAmountMinor;
  return item.commercialTerms.rateAmountMinor;
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
