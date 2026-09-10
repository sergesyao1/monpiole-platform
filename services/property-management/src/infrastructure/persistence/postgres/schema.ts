import {
  bigint, boolean, check, date, doublePrecision, foreignKey, index, integer, numeric, pgPolicy, pgSchema, smallint,
  primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const propertyManagement = pgSchema("property_management");
export const properties = propertyManagement.table("properties", {
  propertyId: uuid("property_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  title: text("title").notNull(), description: text("description"),
  propertyType: text("property_type").notNull(), transactionType: text("transaction_type").notNull(),
  apartmentSubtype: text("apartment_subtype"),
  status: text("status").notNull(), country: text("country").notNull(), city: text("city").notNull(),
  structuralRole: text("structural_role").notNull().default("STANDALONE"),
  district: text("district").notNull(), addressLine: text("address_line").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  publishedByActorId: text("published_by_actor_id"), publicationCorrelationId: uuid("publication_correlation_id"),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true, mode: "string" }),
  withdrawnByActorId: text("withdrawn_by_actor_id"), withdrawalCorrelationId: uuid("withdrawal_correlation_id"),
  availabilityStatus: text("availability_status"), occupancyStatus: text("occupancy_status"),
  availabilityUpdatedAt: timestamp("availability_updated_at", { withTimezone: true, mode: "string" }),
  availabilityUpdatedByActorId: text("availability_updated_by_actor_id"),
  availabilityCorrelationId: uuid("availability_correlation_id"),
  photoStandardVersion: integer("photo_standard_version"),
  usableSurfaceSquareMeters: doublePrecision("usable_surface_square_meters"),
  rooms: integer("rooms"), bedrooms: integer("bedrooms"), bathrooms: integer("bathrooms"),
  furnished: boolean("furnished"), commercialKind: text("commercial_kind"), currency: text("currency"),
  rentAmountMinor: bigint("rent_amount_minor", { mode: "number" }), rentPeriod: text("rent_period"),
  securityDepositAmountMinor: bigint("security_deposit_amount_minor", { mode: "number" }),
  chargesAmountMinor: bigint("charges_amount_minor", { mode: "number" }),
  rateAmountMinor: bigint("rate_amount_minor", { mode: "number" }), pricingUnit: text("pricing_unit"),
  salePriceAmountMinor: bigint("sale_price_amount_minor", { mode: "number" }),
  agencyFeeAmountMinor: bigint("agency_fee_amount_minor", { mode: "number" }),
  cleaningFeeAmountMinor: bigint("cleaning_fee_amount_minor", { mode: "number" }),
  minimumStayNights: integer("minimum_stay_nights"),
  pricingVersion: smallint("pricing_version"),
}, (table) => [
  uniqueIndex("properties_tenant_property_unique").on(table.tenantId, table.propertyId),
  index("properties_tenant_created_property_idx").on(table.tenantId, table.createdAt.desc(), table.propertyId.desc()),
  index("properties_tenant_status_created_property_idx").on(table.tenantId, table.status, table.createdAt.desc(), table.propertyId.desc()),
  index("properties_public_catalog_idx")
    .on(table.tenantId, table.publishedAt.desc(), table.propertyId.desc())
    .where(sql`${table.status} = 'PUBLISHED'`),
  check("properties_title_length_check", sql`char_length(${table.title}) BETWEEN 1 AND 200`),
  check("properties_description_length_check", sql`${table.description} IS NULL OR char_length(${table.description}) <= 5000`),
  check("properties_type_check", sql`${table.propertyType} IN ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHER')`),
  check("properties_transaction_type_check", sql`${table.transactionType} IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL', 'SALE')`),
  check("properties_apartment_subtype_check", sql`
    ${table.apartmentSubtype} IS NULL
    OR (${table.propertyType} = 'APARTMENT' AND ${table.transactionType} = 'LONG_TERM_RENTAL'
      AND ${table.apartmentSubtype} IN ('STUDIO', 'MULTI_ROOM'))
  `),
  check("properties_status_check", sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'WITHDRAWN')`),
  check("properties_photo_standard_version_check", sql`${table.photoStandardVersion} IS NULL OR ${table.photoStandardVersion} = 1`),
  check("properties_country_check", sql`${table.country} ~ '^[A-Z]{2}$'`),
  check("properties_details_values_check", sql`
    (${table.usableSurfaceSquareMeters} IS NULL OR (${table.usableSurfaceSquareMeters} > 0 AND ${table.usableSurfaceSquareMeters} < 'Infinity'::double precision))
    AND (${table.rooms} IS NULL OR ${table.rooms} >= 0)
    AND (${table.bedrooms} IS NULL OR ${table.bedrooms} >= 0)
    AND (${table.bathrooms} IS NULL OR ${table.bathrooms} >= 0)
    AND (${table.rooms} IS NULL OR ${table.bedrooms} IS NULL OR ${table.bedrooms} <= ${table.rooms})
  `),
  check("properties_commercial_terms_check", sql`
    (${table.commercialKind} IS NULL AND ${table.currency} IS NULL
      AND ${table.rentAmountMinor} IS NULL AND ${table.rentPeriod} IS NULL AND ${table.securityDepositAmountMinor} IS NULL
      AND ${table.chargesAmountMinor} IS NULL AND ${table.rateAmountMinor} IS NULL AND ${table.pricingUnit} IS NULL
      AND ${table.salePriceAmountMinor} IS NULL AND ${table.agencyFeeAmountMinor} IS NULL
      AND ${table.cleaningFeeAmountMinor} IS NULL AND ${table.minimumStayNights} IS NULL
      AND (${table.pricingVersion} IS NULL OR ${table.pricingVersion} = 1))
    OR
    (${table.pricingVersion} IN (1, 2)
      AND ((${table.pricingVersion} = 1 AND ${table.currency} ~ '^[A-Z]{3}$')
        OR (${table.pricingVersion} = 2 AND ${table.currency} = 'XOF'))
      AND (${table.pricingVersion} = 2 OR (${table.agencyFeeAmountMinor} IS NULL
        AND ${table.cleaningFeeAmountMinor} IS NULL AND ${table.minimumStayNights} IS NULL
        AND (${table.commercialKind} <> 'SHORT_TERM_RENTAL' OR ${table.securityDepositAmountMinor} IS NULL)))
      AND (
        (${table.commercialKind} = 'LONG_TERM_RENTAL' AND ${table.transactionType} = 'LONG_TERM_RENTAL'
          AND ${table.rentAmountMinor} BETWEEN CASE WHEN ${table.pricingVersion} = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND ${table.rentPeriod} = 'MONTH'
          AND (${table.securityDepositAmountMinor} IS NULL OR ${table.securityDepositAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND (${table.chargesAmountMinor} IS NULL OR ${table.chargesAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND (${table.agencyFeeAmountMinor} IS NULL OR ${table.agencyFeeAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND ${table.rateAmountMinor} IS NULL AND ${table.pricingUnit} IS NULL AND ${table.salePriceAmountMinor} IS NULL
          AND ${table.cleaningFeeAmountMinor} IS NULL AND ${table.minimumStayNights} IS NULL)
        OR (${table.commercialKind} = 'SHORT_TERM_RENTAL' AND ${table.transactionType} = 'SHORT_TERM_RENTAL'
          AND ${table.rateAmountMinor} BETWEEN CASE WHEN ${table.pricingVersion} = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND ${table.pricingUnit} IN ('NIGHT', 'WEEK')
          AND (${table.securityDepositAmountMinor} IS NULL OR ${table.securityDepositAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND (${table.cleaningFeeAmountMinor} IS NULL OR ${table.cleaningFeeAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND (${table.minimumStayNights} IS NULL OR ${table.minimumStayNights} >= 1)
          AND ${table.rentAmountMinor} IS NULL AND ${table.rentPeriod} IS NULL
          AND ${table.chargesAmountMinor} IS NULL AND ${table.salePriceAmountMinor} IS NULL AND ${table.agencyFeeAmountMinor} IS NULL)
        OR (${table.commercialKind} = 'SALE' AND ${table.transactionType} = 'SALE'
          AND ${table.salePriceAmountMinor} BETWEEN CASE WHEN ${table.pricingVersion} = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND (${table.agencyFeeAmountMinor} IS NULL OR ${table.agencyFeeAmountMinor} BETWEEN 0 AND 9007199254740991)
          AND ${table.rentAmountMinor} IS NULL AND ${table.rentPeriod} IS NULL AND ${table.securityDepositAmountMinor} IS NULL
          AND ${table.chargesAmountMinor} IS NULL AND ${table.rateAmountMinor} IS NULL AND ${table.pricingUnit} IS NULL
          AND ${table.cleaningFeeAmountMinor} IS NULL AND ${table.minimumStayNights} IS NULL)
      ))
  `),
  check("properties_structural_role_check", sql`${table.structuralRole} IN ('STANDALONE', 'COMPOSITE', 'UNIT')`),
  check("properties_availability_occupancy_check", sql`
    (${table.availabilityStatus} IS NULL AND ${table.occupancyStatus} IS NULL
      AND ${table.availabilityUpdatedAt} IS NULL AND ${table.availabilityUpdatedByActorId} IS NULL
      AND ${table.availabilityCorrelationId} IS NULL)
    OR
    (${table.structuralRole} IN ('STANDALONE', 'UNIT')
      AND ${table.availabilityStatus} IN ('AVAILABLE', 'UNAVAILABLE')
      AND ${table.occupancyStatus} IN ('VACANT', 'OCCUPIED')
      AND ${table.availabilityUpdatedAt} IS NOT NULL AND ${table.availabilityUpdatedByActorId} IS NOT NULL
      AND ${table.availabilityCorrelationId} IS NOT NULL)
  `),
  check("properties_publication_state_check", sql`
    (${table.status} = 'DRAFT' AND ${table.publishedAt} IS NULL AND ${table.publishedByActorId} IS NULL
      AND ${table.publicationCorrelationId} IS NULL AND ${table.withdrawnAt} IS NULL
      AND ${table.withdrawnByActorId} IS NULL AND ${table.withdrawalCorrelationId} IS NULL)
    OR
    (${table.status} = 'PUBLISHED' AND ${table.publishedAt} IS NOT NULL AND ${table.publishedByActorId} IS NOT NULL
      AND ${table.publicationCorrelationId} IS NOT NULL AND ${table.withdrawnAt} IS NULL
      AND ${table.withdrawnByActorId} IS NULL AND ${table.withdrawalCorrelationId} IS NULL
      AND ${table.commercialKind} IS NOT NULL)
    OR
    (${table.status} = 'WITHDRAWN' AND ${table.publishedAt} IS NOT NULL AND ${table.publishedByActorId} IS NOT NULL
      AND ${table.publicationCorrelationId} IS NOT NULL AND ${table.withdrawnAt} IS NOT NULL
      AND ${table.withdrawnByActorId} IS NOT NULL AND ${table.withdrawalCorrelationId} IS NOT NULL
      AND ${table.withdrawnAt} >= ${table.publishedAt} AND ${table.commercialKind} IS NOT NULL)
  `),
  pgPolicy("properties_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
  pgPolicy("properties_public_catalog_published_select", {
    as: "restrictive",
    for: "select",
    to: "monpiole_public_catalog_reader",
    using: sql`${table.status} = 'PUBLISHED'`,
  }),
]).enableRLS();

export const amenities = propertyManagement.table("amenities", {
  code: text("code").primaryKey(), category: text("category").notNull(), labelFr: text("label_fr").notNull(),
  displayOrder: integer("display_order").notNull(), active: boolean("active").notNull().default(true),
}, (table) => [uniqueIndex("amenities_category_order_unique").on(table.category, table.displayOrder)]);

export const propertyAmenities = propertyManagement.table("property_amenities", {
  tenantId: uuid("tenant_id").notNull(), propertyId: uuid("property_id").notNull(), amenityCode: text("amenity_code").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(), correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.propertyId, table.amenityCode] }),
  foreignKey({ name: "property_amenities_property_tenant_fk", columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId] }),
  foreignKey({ name: "property_amenities_amenity_fk", columns: [table.amenityCode], foreignColumns: [amenities.code] }),
  index("property_amenities_tenant_property_idx").on(table.tenantId, table.propertyId),
  pgPolicy("property_amenities_tenant_isolation", { using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`, withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid` }),
]).enableRLS();

export const propertyGeolocations = propertyManagement.table("property_geolocations", {
  tenantId: uuid("tenant_id").notNull(),
  propertyId: uuid("property_id").notNull(),
  latitude: numeric("latitude", { precision: 8, scale: 6, mode: "number" }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }).notNull(),
  publicVisibility: text("public_visibility").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(),
  actorId: text("actor_id").notNull(),
}, (table) => [
  primaryKey({ name: "property_geolocations_pkey", columns: [table.tenantId, table.propertyId] }),
  foreignKey({
    name: "property_geolocations_property_tenant_fk",
    columns: [table.tenantId, table.propertyId],
    foreignColumns: [properties.tenantId, properties.propertyId],
  }),
  check("property_geolocations_latitude_check", sql`${table.latitude} BETWEEN -90 AND 90`),
  check("property_geolocations_longitude_check", sql`${table.longitude} BETWEEN -180 AND 180`),
  check("property_geolocations_public_visibility_check", sql`${table.publicVisibility} IN ('EXACT', 'APPROXIMATE', 'HIDDEN')`),
  pgPolicy("property_geolocations_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyPhotos = propertyManagement.table("property_photos", {
  photoId: uuid("photo_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  propertyId: uuid("property_id").notNull(), category: text("category").notNull(),
  mediaKind: text("media_kind").notNull().default("IMAGE"), galleryPosition: integer("gallery_position"),
  status: text("status").notNull(), url: text("url"), isPrimary: boolean("is_primary").notNull().default(false),
  contentBase64: text("content_base64"), contentType: text("content_type"),
  contentByteSize: bigint("content_byte_size", { mode: "number" }), contentSha256: text("content_sha256"),
  registeredAt: timestamp("registered_at", { withTimezone: true, mode: "string" }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  uniqueIndex("property_photos_tenant_property_photo_unique").on(table.tenantId, table.propertyId, table.photoId),
  uniqueIndex("property_photos_one_primary_per_property_idx")
    .on(table.tenantId, table.propertyId).where(sql`${table.isPrimary}`),
  uniqueIndex("property_photos_gallery_position_unique_idx")
    .on(table.tenantId, table.propertyId, table.galleryPosition).where(sql`${table.galleryPosition} IS NOT NULL`),
  foreignKey({
    name: "property_photos_property_tenant_fk",
    columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId],
  }),
  index("property_photos_tenant_property_registered_idx").on(table.tenantId, table.propertyId, table.registeredAt, table.photoId),
  check("property_photos_category_check", sql`${table.category} IN (
    'BUILDING_EXTERIOR_OR_ENTRANCE', 'MAIN_LIVING_SLEEPING_AREA', 'LIVING_ROOM_OR_MAIN_ROOM',
    'KITCHEN_OR_KITCHENETTE', 'BEDROOM_OR_SLEEPING_AREA', 'BATHROOM_OR_SHOWER_ROOM',
    'EXTERIOR', 'INTERIOR', 'LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'OTHER'
  )`),
  check("property_photos_status_check", sql`${table.status} IN ('PENDING', 'AVAILABLE')`),
  check("property_photos_media_kind_check", sql`${table.mediaKind} = 'IMAGE'`),
  check("property_photos_gallery_position_check", sql`
    (${table.contentBase64} IS NULL AND ${table.galleryPosition} IS NULL)
    OR (${table.contentBase64} IS NOT NULL AND ${table.galleryPosition} IS NOT NULL AND ${table.galleryPosition} >= 0)
  `),
  check("property_photos_url_check", sql`${table.url} IS NULL OR (char_length(${table.url}) BETWEEN 1 AND 2048 AND ${table.url} ~ '^https://')`),
  check("property_photos_content_check", sql`
    (${table.contentBase64} IS NULL AND ${table.contentType} IS NULL
      AND ${table.contentByteSize} IS NULL AND ${table.contentSha256} IS NULL AND ${table.url} IS NOT NULL)
    OR
    (${table.status} = 'AVAILABLE' AND ${table.contentBase64} IS NOT NULL AND char_length(${table.contentBase64}) > 0
      AND ${table.contentType} IN ('image/jpeg', 'image/png', 'image/webp')
      AND octet_length(decode(${table.contentBase64}, 'base64')) = ${table.contentByteSize}
      AND ${table.contentByteSize} > 0 AND ${table.contentSha256} ~ '^[0-9a-f]{64}$' AND ${table.availableAt} IS NOT NULL)
  `),
  pgPolicy("property_photos_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
  pgPolicy("property_photos_public_catalog_media_select", {
    as: "restrictive",
    for: "select",
    to: "monpiole_public_catalog_reader",
    using: sql`
      ${table.status} = 'AVAILABLE'
      AND ${table.contentBase64} IS NOT NULL
      AND ${table.contentType} IS NOT NULL
      AND ${table.contentByteSize} IS NOT NULL
      AND ${table.contentSha256} IS NOT NULL
      AND ${table.mediaKind} = 'IMAGE'
      AND ${table.galleryPosition} IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM ${properties} AS "public_catalog_property"
        WHERE "public_catalog_property"."tenant_id" = ${table.tenantId}
          AND "public_catalog_property"."property_id" = ${table.propertyId}
          AND "public_catalog_property"."status" = 'PUBLISHED'
      )
    `,
  }),
]).enableRLS();

export const propertyPhotoStandards = propertyManagement.table("property_photo_standards", {
  tenantId: uuid("tenant_id").primaryKey(),
  minimumPhotoCount: integer("minimum_photo_count").notNull().default(1),
  additionalRequiredCategories: text("additional_required_categories").array().notNull().default(sql`ARRAY[]::text[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  check("property_photo_standards_minimum_check", sql`${table.minimumPhotoCount} >= 1`),
  check("property_photo_standards_categories_check", sql`${table.additionalRequiredCategories} <@ ARRAY[
    'BUILDING_EXTERIOR_OR_ENTRANCE', 'MAIN_LIVING_SLEEPING_AREA', 'LIVING_ROOM_OR_MAIN_ROOM',
    'KITCHEN_OR_KITCHENETTE', 'BEDROOM_OR_SLEEPING_AREA', 'BATHROOM_OR_SHOWER_ROOM', 'OTHER'
  ]::text[]`),
  pgPolicy("property_photo_standards_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyPrimaryPhotoAudits = propertyManagement.table("property_primary_photo_audits", {
  auditId: uuid("audit_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  propertyId: uuid("property_id").notNull(), previousPhotoId: uuid("previous_photo_id"),
  selectedPhotoId: uuid("selected_photo_id").notNull(), propertyStatus: text("property_status").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  foreignKey({
    name: "property_primary_photo_audits_property_tenant_fk",
    columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId],
  }),
  index("property_primary_photo_audits_tenant_property_selected_idx")
    .on(table.tenantId, table.propertyId, table.selectedAt, table.auditId),
  check("property_primary_photo_audits_status_check", sql`${table.propertyStatus} IN ('DRAFT', 'PUBLISHED', 'WITHDRAWN')`),
  check("property_primary_photo_audits_replacement_check", sql`${table.previousPhotoId} IS NULL OR ${table.previousPhotoId} <> ${table.selectedPhotoId}`),
  pgPolicy("property_primary_photo_audits_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyBuildings = propertyManagement.table("property_buildings", {
  buildingId: uuid("building_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  propertyId: uuid("property_id").notNull(), buildingCode: text("building_code").notNull(), name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  uniqueIndex("property_buildings_tenant_building_unique").on(table.tenantId, table.buildingId),
  uniqueIndex("property_buildings_tenant_property_code_unique").on(table.tenantId, table.propertyId, table.buildingCode),
  foreignKey({ name: "property_buildings_property_tenant_fk", columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId] }),
  index("property_buildings_tenant_property_code_idx").on(table.tenantId, table.propertyId, table.buildingCode, table.buildingId),
  check("property_buildings_code_check", sql`${table.buildingCode} ~ '^[A-Z0-9][A-Z0-9._/ -]{0,49}$'`),
  check("property_buildings_name_check", sql`length(btrim(${table.name})) BETWEEN 1 AND 200`),
  pgPolicy("property_buildings_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyBuildingUnits = propertyManagement.table("property_building_units", {
  tenantId: uuid("tenant_id").notNull(), buildingId: uuid("building_id").notNull(),
  unitPropertyId: uuid("unit_property_id").notNull(), unitCode: text("unit_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  primaryKey({ name: "property_building_units_pkey", columns: [table.tenantId, table.buildingId, table.unitPropertyId] }),
  foreignKey({ name: "property_building_units_building_tenant_fk", columns: [table.tenantId, table.buildingId], foreignColumns: [propertyBuildings.tenantId, propertyBuildings.buildingId] }),
  foreignKey({ name: "property_building_units_property_tenant_fk", columns: [table.tenantId, table.unitPropertyId], foreignColumns: [properties.tenantId, properties.propertyId] }),
  uniqueIndex("property_building_units_tenant_unit_unique").on(table.tenantId, table.unitPropertyId),
  uniqueIndex("property_building_units_tenant_building_code_unique").on(table.tenantId, table.buildingId, table.unitCode),
  index("property_building_units_tenant_building_code_idx").on(table.tenantId, table.buildingId, table.unitCode, table.unitPropertyId),
  check("property_building_units_code_check", sql`${table.unitCode} ~ '^[A-Z0-9][A-Z0-9._/ -]{0,49}$'`),
  pgPolicy("property_building_units_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyOwners = propertyManagement.table("property_owners", {
  ownerId: uuid("owner_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  ownerType: text("owner_type").notNull(),
  firstName: text("first_name"), lastName: text("last_name"),
  legalName: text("legal_name"), registrationNumber: text("registration_number"),
  phoneNumber: text("phone_number"), email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  uniqueIndex("property_owners_tenant_owner_unique").on(table.tenantId, table.ownerId),
  index("property_owners_tenant_created_owner_idx").on(table.tenantId, table.createdAt.desc(), table.ownerId.desc()),
  check("property_owners_identity_check", sql`
    (${table.ownerType} = 'INDIVIDUAL'
      AND char_length(btrim(${table.firstName})) BETWEEN 1 AND 200
      AND char_length(btrim(${table.lastName})) BETWEEN 1 AND 200
      AND ${table.legalName} IS NULL AND ${table.registrationNumber} IS NULL)
    OR
    (${table.ownerType} = 'LEGAL_ENTITY'
      AND char_length(btrim(${table.legalName})) BETWEEN 1 AND 300
      AND ${table.firstName} IS NULL AND ${table.lastName} IS NULL
      AND (${table.registrationNumber} IS NULL OR char_length(btrim(${table.registrationNumber})) BETWEEN 1 AND 200))
  `),
  check("property_owners_contact_check", sql`
    (${table.phoneNumber} IS NULL OR char_length(btrim(${table.phoneNumber})) BETWEEN 1 AND 100)
    AND (${table.email} IS NULL OR (char_length(${table.email}) BETWEEN 3 AND 320 AND ${table.email} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'))
  `),
  pgPolicy("property_owners_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyOwnerships = propertyManagement.table("property_ownerships", {
  tenantId: uuid("tenant_id").notNull(), propertyId: uuid("property_id").notNull(), ownerId: uuid("owner_id").notNull(),
  ownershipShare: numeric("ownership_share", { precision: 5, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  primaryKey({ name: "property_ownerships_pkey", columns: [table.tenantId, table.propertyId, table.ownerId] }),
  foreignKey({
    name: "property_ownerships_property_tenant_fk",
    columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId],
  }),
  foreignKey({
    name: "property_ownerships_owner_tenant_fk",
    columns: [table.tenantId, table.ownerId], foreignColumns: [propertyOwners.tenantId, propertyOwners.ownerId],
  }),
  index("property_ownerships_tenant_owner_idx").on(table.tenantId, table.ownerId),
  check("property_ownerships_share_check", sql`${table.ownershipShare} > 0 AND ${table.ownershipShare} <= 100`),
  pgPolicy("property_ownerships_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyClients = propertyManagement.table("property_clients", {
  clientId: uuid("client_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  displayName: text("display_name").notNull(), email: text("email"), phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
}, (table) => [
  uniqueIndex("property_clients_tenant_client_unique").on(table.tenantId, table.clientId),
  index("property_clients_tenant_created_client_idx").on(table.tenantId, table.createdAt.desc(), table.clientId.desc()),
  check("property_clients_display_name_check", sql`char_length(btrim(${table.displayName})) BETWEEN 1 AND 200`),
  check("property_clients_contact_check", sql`
    (${table.phoneNumber} IS NULL OR char_length(btrim(${table.phoneNumber})) BETWEEN 1 AND 100)
    AND (${table.email} IS NULL OR (char_length(${table.email}) BETWEEN 3 AND 320
      AND ${table.email} = lower(${table.email})
      AND ${table.email} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'))
  `),
  check("property_clients_timestamps_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  pgPolicy("property_clients_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyContracts = propertyManagement.table("property_contracts", {
  contractId: uuid("contract_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  propertyId: uuid("property_id").notNull(), clientId: uuid("client_id").notNull(),
  contractType: text("contract_type").notNull(), status: text("status").notNull(), reference: text("reference").notNull(),
  startDate: date("start_date", { mode: "string" }), endDate: date("end_date", { mode: "string" }), notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true, mode: "string" }),
  activatedByActorId: text("activated_by_actor_id"), activationCorrelationId: uuid("activation_correlation_id"),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  endedByActorId: text("ended_by_actor_id"), endingCorrelationId: uuid("ending_correlation_id"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  cancelledByActorId: text("cancelled_by_actor_id"), cancellationCorrelationId: uuid("cancellation_correlation_id"),
}, (table) => [
  uniqueIndex("property_contracts_tenant_contract_unique").on(table.tenantId, table.contractId),
  uniqueIndex("property_contracts_tenant_reference_unique").on(table.tenantId, table.reference),
  foreignKey({
    name: "property_contracts_property_tenant_fk",
    columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId],
  }),
  foreignKey({
    name: "property_contracts_client_tenant_fk",
    columns: [table.tenantId, table.clientId], foreignColumns: [propertyClients.tenantId, propertyClients.clientId],
  }),
  index("property_contracts_tenant_property_created_idx")
    .on(table.tenantId, table.propertyId, table.createdAt.desc(), table.contractId.desc()),
  index("property_contracts_tenant_property_status_idx").on(table.tenantId, table.propertyId, table.status),
  index("property_contracts_tenant_client_idx").on(table.tenantId, table.clientId),
  check("property_contracts_type_check", sql`${table.contractType} IN ('LEASE', 'MANAGEMENT', 'OTHER')`),
  check("property_contracts_status_check", sql`${table.status} IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')`),
  check("property_contracts_reference_check", sql`
    ${table.reference} = upper(${table.reference})
    AND ${table.reference} ~ '^[A-Z0-9][A-Z0-9._/ -]{0,99}$'
  `),
  check("property_contracts_dates_check", sql`
    (${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate})
    AND (${table.notes} IS NULL OR char_length(btrim(${table.notes})) BETWEEN 1 AND 5000)
    AND ${table.updatedAt} >= ${table.createdAt}
  `),
  check("property_contracts_lifecycle_check", sql`
    (${table.status} = 'DRAFT'
      AND ${table.activatedAt} IS NULL AND ${table.activatedByActorId} IS NULL AND ${table.activationCorrelationId} IS NULL
      AND ${table.endedAt} IS NULL AND ${table.endedByActorId} IS NULL AND ${table.endingCorrelationId} IS NULL
      AND ${table.cancelledAt} IS NULL AND ${table.cancelledByActorId} IS NULL AND ${table.cancellationCorrelationId} IS NULL)
    OR (${table.status} = 'ACTIVE'
      AND ${table.startDate} IS NOT NULL
      AND ${table.activatedAt} IS NOT NULL AND ${table.activatedAt} >= ${table.createdAt}
      AND ${table.activatedByActorId} IS NOT NULL AND ${table.activationCorrelationId} IS NOT NULL
      AND ${table.endedAt} IS NULL AND ${table.endedByActorId} IS NULL AND ${table.endingCorrelationId} IS NULL
      AND ${table.cancelledAt} IS NULL AND ${table.cancelledByActorId} IS NULL AND ${table.cancellationCorrelationId} IS NULL)
    OR (${table.status} = 'ENDED'
      AND ${table.startDate} IS NOT NULL AND ${table.endDate} IS NOT NULL
      AND ${table.activatedAt} IS NOT NULL AND ${table.activatedAt} >= ${table.createdAt}
      AND ${table.activatedByActorId} IS NOT NULL AND ${table.activationCorrelationId} IS NOT NULL
      AND ${table.endedAt} IS NOT NULL AND ${table.endedAt} >= ${table.activatedAt}
      AND ${table.endedByActorId} IS NOT NULL AND ${table.endingCorrelationId} IS NOT NULL
      AND ${table.cancelledAt} IS NULL AND ${table.cancelledByActorId} IS NULL AND ${table.cancellationCorrelationId} IS NULL)
    OR (${table.status} = 'CANCELLED'
      AND ${table.endedAt} IS NULL AND ${table.endedByActorId} IS NULL AND ${table.endingCorrelationId} IS NULL
      AND ${table.cancelledAt} IS NOT NULL AND ${table.cancelledAt} >= ${table.createdAt}
      AND ${table.cancellationCorrelationId} IS NOT NULL AND ${table.cancelledByActorId} IS NOT NULL
      AND ((${table.activatedAt} IS NULL AND ${table.activatedByActorId} IS NULL AND ${table.activationCorrelationId} IS NULL)
        OR (${table.activatedAt} IS NOT NULL AND ${table.activatedAt} >= ${table.createdAt}
          AND ${table.cancelledAt} >= ${table.activatedAt}
          AND ${table.activatedByActorId} IS NOT NULL AND ${table.activationCorrelationId} IS NOT NULL)))
  `),
  pgPolicy("property_contracts_tenant_isolation", {
    using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]).enableRLS();

export const propertyInquiries = propertyManagement.table("property_inquiries", {
  inquiryId: uuid("inquiry_id").primaryKey(), tenantId: uuid("tenant_id").notNull(), propertyId: uuid("property_id").notNull(),
  contactName: text("contact_name").notNull(), email: text("email"), phoneNumber: text("phone_number"), message: text("message"),
  consentVersion: text("consent_version").notNull(), consentGivenAt: timestamp("consent_given_at", { withTimezone: true, mode: "string" }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(), status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "string" }), closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  uniqueIndex("property_inquiries_tenant_inquiry_unique").on(table.tenantId, table.inquiryId),
  uniqueIndex("property_inquiries_tenant_property_idempotency_unique").on(table.tenantId, table.propertyId, table.idempotencyKey),
  foreignKey({ name: "property_inquiries_property_tenant_fk", columns: [table.tenantId, table.propertyId], foreignColumns: [properties.tenantId, properties.propertyId] }),
  index("property_inquiries_tenant_property_created_idx").on(table.tenantId, table.propertyId, table.createdAt.desc(), table.inquiryId.desc()),
  check("property_inquiries_contact_check", sql`char_length(btrim(${table.contactName})) BETWEEN 1 AND 200 AND (${table.email} IS NOT NULL OR ${table.phoneNumber} IS NOT NULL) AND (${table.email} IS NULL OR (char_length(${table.email}) BETWEEN 3 AND 320 AND ${table.email} = lower(${table.email}) AND ${table.email} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')) AND (${table.phoneNumber} IS NULL OR char_length(btrim(${table.phoneNumber})) BETWEEN 1 AND 100) AND (${table.message} IS NULL OR char_length(btrim(${table.message})) BETWEEN 1 AND 2000)`),
  check("property_inquiries_consent_check", sql`char_length(btrim(${table.consentVersion})) BETWEEN 1 AND 50 AND char_length(btrim(${table.idempotencyKey})) BETWEEN 1 AND 100`),
  check("property_inquiries_lifecycle_check", sql`(${table.status}='NEW' AND ${table.acknowledgedAt} IS NULL AND ${table.closedAt} IS NULL) OR (${table.status}='ACKNOWLEDGED' AND ${table.acknowledgedAt} IS NOT NULL AND ${table.closedAt} IS NULL) OR (${table.status}='CLOSED' AND ${table.closedAt} IS NOT NULL)`),
  pgPolicy("property_inquiries_tenant_isolation", { using: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid`, withCheck: sql`${table.tenantId} = NULLIF(current_setting('app.tenant_id', true), '')::uuid` }),
]).enableRLS();

export const propertyViewings=propertyManagement.table("property_viewings",{viewingId:uuid("viewing_id").primaryKey(),tenantId:uuid("tenant_id").notNull(),propertyId:uuid("property_id").notNull(),inquiryId:uuid("inquiry_id").notNull(),status:text("status").notNull(),startsAt:timestamp("starts_at",{withTimezone:true,mode:"string"}).notNull(),endsAt:timestamp("ends_at",{withTimezone:true,mode:"string"}).notNull(),timeZone:text("time_zone").notNull(),createdAt:timestamp("created_at",{withTimezone:true,mode:"string"}).notNull(),updatedAt:timestamp("updated_at",{withTimezone:true,mode:"string"}).notNull(),correlationId:uuid("correlation_id").notNull(),actorId:text("actor_id").notNull(),completedAt:timestamp("completed_at",{withTimezone:true,mode:"string"}),cancelledAt:timestamp("cancelled_at",{withTimezone:true,mode:"string"})},table=>[
 uniqueIndex("property_viewings_tenant_viewing_unique").on(table.tenantId,table.viewingId),uniqueIndex("property_viewings_tenant_property_viewing_unique").on(table.tenantId,table.propertyId,table.viewingId),uniqueIndex("property_viewings_tenant_inquiry_unique").on(table.tenantId,table.inquiryId),foreignKey({name:"property_viewings_property_tenant_fk",columns:[table.tenantId,table.propertyId],foreignColumns:[properties.tenantId,properties.propertyId]}),foreignKey({name:"property_viewings_inquiry_tenant_fk",columns:[table.tenantId,table.inquiryId],foreignColumns:[propertyInquiries.tenantId,propertyInquiries.inquiryId]}),index("property_viewings_tenant_property_time_idx").on(table.tenantId,table.propertyId,table.startsAt,table.viewingId),check("property_viewings_time_check",sql`${table.endsAt}>${table.startsAt} AND ${table.endsAt}<=${table.startsAt}+interval '4 hours' AND char_length(btrim(${table.timeZone})) BETWEEN 1 AND 100`),check("property_viewings_lifecycle_check",sql`(${table.status}='SCHEDULED' AND ${table.completedAt} IS NULL AND ${table.cancelledAt} IS NULL) OR (${table.status}='COMPLETED' AND ${table.completedAt} IS NOT NULL AND ${table.cancelledAt} IS NULL) OR (${table.status}='CANCELLED' AND ${table.cancelledAt} IS NOT NULL AND ${table.completedAt} IS NULL)`),pgPolicy("property_viewings_tenant_isolation",{using:sql`${table.tenantId}=NULLIF(current_setting('app.tenant_id',true),'')::uuid`,withCheck:sql`${table.tenantId}=NULLIF(current_setting('app.tenant_id',true),'')::uuid`})]).enableRLS();

export const propertyViewingOutcomes=propertyManagement.table("property_viewing_outcomes",{outcomeId:uuid("outcome_id").primaryKey(),tenantId:uuid("tenant_id").notNull(),propertyId:uuid("property_id").notNull(),viewingId:uuid("viewing_id").notNull(),status:text("status").notNull(),note:text("note"),createdAt:timestamp("created_at",{withTimezone:true,mode:"string"}).notNull(),updatedAt:timestamp("updated_at",{withTimezone:true,mode:"string"}).notNull(),decidedAt:timestamp("decided_at",{withTimezone:true,mode:"string"}),correlationId:uuid("correlation_id").notNull(),actorId:text("actor_id").notNull()},table=>[
 uniqueIndex("property_viewing_outcomes_tenant_outcome_unique").on(table.tenantId,table.outcomeId),uniqueIndex("property_viewing_outcomes_tenant_viewing_unique").on(table.tenantId,table.viewingId),foreignKey({name:"property_viewing_outcomes_viewing_tenant_fk",columns:[table.tenantId,table.propertyId,table.viewingId],foreignColumns:[propertyViewings.tenantId,propertyViewings.propertyId,propertyViewings.viewingId]}),check("property_viewing_outcomes_note_check",sql`${table.note} IS NULL OR char_length(btrim(${table.note})) BETWEEN 1 AND 2000`),check("property_viewing_outcomes_lifecycle_check",sql`(${table.status}='FOLLOW_UP_REQUIRED' AND ${table.decidedAt} IS NULL) OR (${table.status} IN ('PROCEED','DECLINED') AND ${table.decidedAt} IS NOT NULL)`),pgPolicy("property_viewing_outcomes_tenant_isolation",{using:sql`${table.tenantId}=NULLIF(current_setting('app.tenant_id',true),'')::uuid`,withCheck:sql`${table.tenantId}=NULLIF(current_setting('app.tenant_id',true),'')::uuid`})]).enableRLS();
