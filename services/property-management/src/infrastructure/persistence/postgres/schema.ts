import { bigint, boolean, doublePrecision, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
]);
