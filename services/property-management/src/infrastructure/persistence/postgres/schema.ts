import {
  bigint, boolean, doublePrecision, foreignKey, index, integer, numeric, pgSchema,
  primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const propertyManagement = pgSchema("property_management");
export const properties = propertyManagement.table("properties", {
  propertyId: uuid("property_id").primaryKey(), tenantId: uuid("tenant_id").notNull(),
  title: text("title").notNull(), description: text("description"),
  propertyType: text("property_type").notNull(), transactionType: text("transaction_type").notNull(),
  status: text("status").notNull(), country: text("country").notNull(), city: text("city").notNull(),
  district: text("district").notNull(), addressLine: text("address_line").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  correlationId: uuid("correlation_id").notNull(), actorId: text("actor_id").notNull(),
  usableSurfaceSquareMeters: doublePrecision("usable_surface_square_meters"),
  rooms: integer("rooms"), bedrooms: integer("bedrooms"), bathrooms: integer("bathrooms"),
  furnished: boolean("furnished"), commercialKind: text("commercial_kind"), currency: text("currency"),
  rentAmountMinor: bigint("rent_amount_minor", { mode: "number" }), rentPeriod: text("rent_period"),
  securityDepositAmountMinor: bigint("security_deposit_amount_minor", { mode: "number" }),
  chargesAmountMinor: bigint("charges_amount_minor", { mode: "number" }),
  rateAmountMinor: bigint("rate_amount_minor", { mode: "number" }), pricingUnit: text("pricing_unit"),
  salePriceAmountMinor: bigint("sale_price_amount_minor", { mode: "number" }),
}, (table) => [
  uniqueIndex("properties_tenant_property_unique").on(table.tenantId, table.propertyId),
  index("properties_tenant_created_property_idx").on(table.tenantId, table.createdAt.desc(), table.propertyId.desc()),
]);

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
]);

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
]);
