import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

import type { PropertyRepository } from "../../../application/property-repository.js";
import { Property, type PropertyStatus, type PropertyStructuralRole, type PropertyType, type TransactionType } from "../../../domain/property.js";
import type { CommercialTerms, PropertyDetails } from "../../../domain/property-details.js";
import { properties } from "./schema.js";

export class PostgresPropertyRepository implements PropertyRepository {
  constructor(private readonly pool: Pool) {}
  save(property: Property, correlationId: string, actorId: string): Promise<void> {
    return withTenantPostgresTransaction(this.pool, property.values.tenantId, async (scope) => {
      const value = property.values;
      await scope.database().insert(properties).values({
        propertyId: value.propertyId, tenantId: value.tenantId, title: value.title,
        description: value.description, propertyType: value.propertyType,
        transactionType: value.transactionType, status: value.status,
        structuralRole: value.structuralRole,
        country: value.location.country, city: value.location.city, district: value.location.district,
        addressLine: value.location.addressLine, createdAt: value.createdAt, updatedAt: value.updatedAt,
        correlationId, actorId,
      });
    });
  }
  findById(tenantId: string, propertyId: string): Promise<Property | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1))[0];
      return row === undefined ? undefined : toProperty(row);
    });
  }
  updateAtomically(
    tenantId: string,
    propertyId: string,
    update: (property: Property) => Property,
    trace: { readonly correlationId: string; readonly actorId: string },
  ): Promise<Property | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (row === undefined) return undefined;
      const property = update(toProperty(row));
      const details = property.values.details;
      const terms = property.values.commercialTerms;
      await scope.database().update(properties).set({
        title: property.values.title, description: property.values.description ?? null,
        country: property.values.location.country, city: property.values.location.city,
        district: property.values.location.district, addressLine: property.values.location.addressLine,
        usableSurfaceSquareMeters: details?.usableSurfaceSquareMeters ?? null,
        rooms: details?.rooms ?? null, bedrooms: details?.bedrooms ?? null,
        bathrooms: details?.bathrooms ?? null, furnished: details?.furnished ?? null,
        commercialKind: terms?.kind ?? null, currency: terms?.currency ?? null,
        rentAmountMinor: terms?.kind === "LONG_TERM_RENTAL" ? terms.rentAmountMinor : null,
        rentPeriod: terms?.kind === "LONG_TERM_RENTAL" ? terms.rentPeriod : null,
        securityDepositAmountMinor: terms?.kind === "LONG_TERM_RENTAL" ? terms.securityDepositAmountMinor ?? null : null,
        chargesAmountMinor: terms?.kind === "LONG_TERM_RENTAL" ? terms.chargesAmountMinor ?? null : null,
        rateAmountMinor: terms?.kind === "SHORT_TERM_RENTAL" ? terms.rateAmountMinor : null,
        pricingUnit: terms?.kind === "SHORT_TERM_RENTAL" ? terms.pricingUnit : null,
        salePriceAmountMinor: terms?.kind === "SALE" ? terms.salePriceAmountMinor : null,
        updatedAt: property.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
      }).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)));
      return property;
    });
  }
}

type PropertyRow = typeof properties.$inferSelect;
export function toProperty(row: PropertyRow): Property {
  const details = toDetails(row);
  const commercialTerms = toCommercialTerms(row);
  return Property.rehydrate({
    propertyId: row.propertyId, tenantId: row.tenantId, title: row.title,
    ...(row.description === null ? {} : { description: row.description }),
    propertyType: row.propertyType as PropertyType, transactionType: row.transactionType as TransactionType,
    status: row.status as PropertyStatus,
    structuralRole: row.structuralRole as PropertyStructuralRole,
    location: { country: row.country, city: row.city, district: row.district, addressLine: row.addressLine },
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
    ...(details === undefined ? {} : { details }),
    ...(commercialTerms === undefined ? {} : { commercialTerms }),
  });
}

function toDetails(row: PropertyRow): PropertyDetails | undefined {
  if (row.commercialKind === null) return undefined;
  return {
    ...(row.usableSurfaceSquareMeters === null ? {} : { usableSurfaceSquareMeters: row.usableSurfaceSquareMeters }),
    ...(row.rooms === null ? {} : { rooms: row.rooms }), ...(row.bedrooms === null ? {} : { bedrooms: row.bedrooms }),
    ...(row.bathrooms === null ? {} : { bathrooms: row.bathrooms }),
    ...(row.furnished === null ? {} : { furnished: row.furnished }),
  };
}

function toCommercialTerms(row: PropertyRow): CommercialTerms | undefined {
  if (row.commercialKind === null) return undefined;
  if (row.currency === null) throw new Error("Persisted commercial currency is missing");
  if (row.commercialKind === "LONG_TERM_RENTAL") {
    if (row.rentAmountMinor === null || row.rentPeriod !== "MONTH") throw new Error("Persisted long-term terms are invalid");
    return { kind: "LONG_TERM_RENTAL", currency: row.currency, rentAmountMinor: row.rentAmountMinor, rentPeriod: "MONTH",
      ...(row.securityDepositAmountMinor === null ? {} : { securityDepositAmountMinor: row.securityDepositAmountMinor }),
      ...(row.chargesAmountMinor === null ? {} : { chargesAmountMinor: row.chargesAmountMinor }) };
  }
  if (row.commercialKind === "SHORT_TERM_RENTAL") {
    if (row.rateAmountMinor === null || (row.pricingUnit !== "NIGHT" && row.pricingUnit !== "WEEK")) throw new Error("Persisted short-term terms are invalid");
    return { kind: "SHORT_TERM_RENTAL", currency: row.currency, rateAmountMinor: row.rateAmountMinor, pricingUnit: row.pricingUnit };
  }
  if (row.commercialKind === "SALE") {
    if (row.salePriceAmountMinor === null) throw new Error("Persisted sale terms are invalid");
    return { kind: "SALE", currency: row.currency, salePriceAmountMinor: row.salePriceAmountMinor };
  }
  throw new Error("Persisted commercial kind is invalid");
}
