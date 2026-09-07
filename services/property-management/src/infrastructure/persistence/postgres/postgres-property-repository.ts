import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Pool } from "pg";

import type { PropertyRepository } from "../../../application/property-repository.js";
import {
  PersistedPropertyCorruptionError,
  Property,
  PropertyStructuralRoleConflictError,
  type ApartmentSubtype,
  type PropertyAvailabilityStatus,
  type PropertyOccupancyStatus,
  type PropertyStatus,
  type PropertyStructuralRole,
  type PropertyType,
  type TransactionType,
} from "../../../domain/property.js";
import { sameCommercialTerms, type CommercialTerms, type PropertyDetails } from "../../../domain/property-details.js";
import {
  rehydratePropertyPhoto,
  validatePropertyPhotoStandardOverride,
  type PropertyPhotoCategory,
  type PropertyPhotoStandardOverride,
  type PropertyPhotoValues,
} from "../../../domain/property-photo.js";
import { PropertyBuildingUnit } from "../../../domain/property-building-unit.js";
import { properties, propertyBuildingUnits, propertyPhotos, propertyPhotoStandards } from "./schema.js";

export class PostgresPropertyRepository implements PropertyRepository {
  constructor(private readonly pool: Pool) {}
  async saveStandalone(property: Property, correlationId: string, actorId: string): Promise<void> {
    if (property.values.structuralRole !== "STANDALONE") {
      throw new PropertyStructuralRoleConflictError();
    }
    await withTenantPostgresTransaction(this.pool, property.values.tenantId, async (scope) => {
      const value = property.values;
      await scope.database().insert(properties).values({
        propertyId: value.propertyId, tenantId: value.tenantId, title: value.title,
        description: value.description, propertyType: value.propertyType,
        transactionType: value.transactionType, status: value.status,
        apartmentSubtype: value.apartmentSubtype,
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
      if (row === undefined) return undefined;
      const photoRows = await scope.database().select().from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        eq(propertyPhotos.status, "AVAILABLE"), isNotNull(propertyPhotos.contentBase64),
      )).orderBy(asc(propertyPhotos.registeredAt), asc(propertyPhotos.photoId));
      const property = toProperty(row, photoRows.map(toPropertyPhoto));
      if (property.values.structuralRole === "UNIT") {
        const relations = await scope.database().select().from(propertyBuildingUnits).where(and(
          eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.unitPropertyId, propertyId),
        )).limit(2);
        if (relations.length !== 1) throw new PersistedPropertyCorruptionError("buildingUnit");
        PropertyBuildingUnit.rehydrate(toBuildingUnitValues(relations[0]!), property);
      }
      return property;
    });
  }
  updateAtomically(
    tenantId: string,
    propertyId: string,
    update: (
      property: Property,
      photos: readonly PropertyPhotoValues[],
      standardOverride?: PropertyPhotoStandardOverride,
    ) => Property,
    trace: { readonly correlationId: string; readonly actorId: string },
  ): Promise<Property | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (row === undefined) return undefined;
      const photoRows = await scope.database().select().from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        eq(propertyPhotos.status, "AVAILABLE"), isNotNull(propertyPhotos.contentBase64),
      )).orderBy(asc(propertyPhotos.registeredAt), asc(propertyPhotos.photoId));
      const photos = photoRows.map(toPropertyPhoto);
      const standardRow = (await scope.database().select().from(propertyPhotoStandards).where(
        eq(propertyPhotoStandards.tenantId, tenantId),
      ).limit(1))[0];
      const standardOverride = standardRow === undefined ? undefined : validatePropertyPhotoStandardOverride({
        minimumCount: standardRow.minimumPhotoCount,
        additionalRequiredCategories: standardRow.additionalRequiredCategories as PropertyPhotoCategory[],
      });
      const current = toProperty(row, photos);
      if (current.values.structuralRole === "UNIT") {
        const relations = await scope.database().select().from(propertyBuildingUnits).where(and(
          eq(propertyBuildingUnits.tenantId, tenantId), eq(propertyBuildingUnits.unitPropertyId, propertyId),
        )).limit(2);
        if (relations.length !== 1) throw new PersistedPropertyCorruptionError("buildingUnit");
        PropertyBuildingUnit.rehydrate(toBuildingUnitValues(relations[0]!), current);
      }
      const property = update(current, photos, standardOverride);
      if (property === current) return current;
      if (property.values.structuralRole !== current.values.structuralRole) {
        throw new PropertyStructuralRoleConflictError();
      }
      const firstPublication = current.values.status === "DRAFT" && property.values.status === "PUBLISHED";
      const firstWithdrawal = current.values.status === "PUBLISHED" && property.values.status === "WITHDRAWN";
      const availabilityChanged = current.values.availability?.availabilityStatus !== property.values.availability?.availabilityStatus
        || current.values.availability?.occupancyStatus !== property.values.availability?.occupancyStatus;
      const details = property.values.details;
      const terms = property.values.commercialTerms;
      const pricingChanged = terms !== undefined && !sameCommercialTerms(current.values.commercialTerms, terms);
      await scope.database().update(properties).set({
        title: property.values.title, description: property.values.description ?? null,
        apartmentSubtype: property.values.apartmentSubtype ?? null,
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
        agencyFeeAmountMinor: terms?.kind === "LONG_TERM_RENTAL" || terms?.kind === "SALE" ? terms.agencyFeeAmountMinor ?? null : null,
        rateAmountMinor: terms?.kind === "SHORT_TERM_RENTAL" ? terms.rateAmountMinor : null,
        pricingUnit: terms?.kind === "SHORT_TERM_RENTAL" ? terms.pricingUnit : null,
        cleaningFeeAmountMinor: terms?.kind === "SHORT_TERM_RENTAL" ? terms.cleaningFeeAmountMinor ?? null : null,
        minimumStayNights: terms?.kind === "SHORT_TERM_RENTAL" ? terms.minimumStayNights ?? null : null,
        ...(terms?.kind === "SHORT_TERM_RENTAL"
          ? { securityDepositAmountMinor: terms.securityDepositAmountMinor ?? null }
          : {}),
        salePriceAmountMinor: terms?.kind === "SALE" ? terms.salePriceAmountMinor : null,
        pricingVersion: terms === undefined ? null : pricingChanged ? 2 : row.pricingVersion,
        status: property.values.status, publishedAt: property.values.publishedAt ?? null,
        withdrawnAt: property.values.withdrawnAt ?? null,
        availabilityStatus: property.values.availability?.availabilityStatus ?? null,
        occupancyStatus: property.values.availability?.occupancyStatus ?? null,
        availabilityUpdatedAt: property.values.availability?.updatedAt ?? null,
        ...(firstPublication ? {
          publishedByActorId: trace.actorId,
          publicationCorrelationId: trace.correlationId,
        } : {}),
        ...(firstWithdrawal ? {
          withdrawnByActorId: trace.actorId,
          withdrawalCorrelationId: trace.correlationId,
        } : {}),
        ...(availabilityChanged ? {
          availabilityUpdatedByActorId: property.values.availability === undefined ? null : trace.actorId,
          availabilityCorrelationId: property.values.availability === undefined ? null : trace.correlationId,
        } : {}),
        updatedAt: property.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
      }).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)));
      return property;
    });
  }
}

type BuildingUnitRow = typeof propertyBuildingUnits.$inferSelect;
function toBuildingUnitValues(row: BuildingUnitRow) {
  return {
    tenantId: row.tenantId,
    buildingId: row.buildingId,
    unitPropertyId: row.unitPropertyId,
    unitCode: row.unitCode,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

type PropertyRow = typeof properties.$inferSelect;
export function toProperty(row: PropertyRow, photos: readonly PropertyPhotoValues[] = []): Property {
  const details = toDetails(row);
  const commercialTerms = toCommercialTerms(row);
  return Property.rehydrate({
    propertyId: row.propertyId, tenantId: row.tenantId, title: row.title,
    ...(row.description === null ? {} : { description: row.description }),
    propertyType: row.propertyType as PropertyType, transactionType: row.transactionType as TransactionType,
    ...(row.apartmentSubtype === null ? {} : { apartmentSubtype: row.apartmentSubtype as ApartmentSubtype }),
    status: row.status as PropertyStatus,
    structuralRole: row.structuralRole as PropertyStructuralRole,
    location: { country: row.country, city: row.city, district: row.district, addressLine: row.addressLine },
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
    ...(row.publishedAt === null ? {} : { publishedAt: new Date(row.publishedAt).toISOString() }),
    ...(row.withdrawnAt === null ? {} : { withdrawnAt: new Date(row.withdrawnAt).toISOString() }),
    ...(row.availabilityStatus === null || row.occupancyStatus === null || row.availabilityUpdatedAt === null ? {} : {
      availability: {
        availabilityStatus: row.availabilityStatus as PropertyAvailabilityStatus,
        occupancyStatus: row.occupancyStatus as PropertyOccupancyStatus,
        updatedAt: new Date(row.availabilityUpdatedAt).toISOString(),
      },
    }),
    ...(details === undefined ? {} : { details }),
    ...(commercialTerms === undefined ? {} : { commercialTerms }),
    photos,
  }, { allowLegacyPricing: row.pricingVersion === 1 });
}

type PropertyPhotoRow = typeof propertyPhotos.$inferSelect;
function toPropertyPhoto(row: PropertyPhotoRow): PropertyPhotoValues {
  return rehydratePropertyPhoto({
    photoId: row.photoId, tenantId: row.tenantId, propertyId: row.propertyId,
    category: row.category as PropertyPhotoCategory, status: "AVAILABLE",
    contentType: row.contentType as PropertyPhotoValues["contentType"],
    contentByteSize: row.contentByteSize!, contentSha256: row.contentSha256!,
    isPrimary: row.isPrimary, registeredAt: new Date(row.registeredAt).toISOString(),
    availableAt: new Date(row.availableAt!).toISOString(),
  });
}

function toDetails(row: PropertyRow): PropertyDetails | undefined {
  if (row.usableSurfaceSquareMeters === null && row.rooms === null && row.bedrooms === null
    && row.bathrooms === null && row.furnished === null) return undefined;
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
      ...(row.chargesAmountMinor === null ? {} : { chargesAmountMinor: row.chargesAmountMinor }),
      ...(row.agencyFeeAmountMinor === null ? {} : { agencyFeeAmountMinor: row.agencyFeeAmountMinor }) };
  }
  if (row.commercialKind === "SHORT_TERM_RENTAL") {
    if (row.rateAmountMinor === null || (row.pricingUnit !== "NIGHT" && row.pricingUnit !== "WEEK")) throw new Error("Persisted short-term terms are invalid");
    return { kind: "SHORT_TERM_RENTAL", currency: row.currency, rateAmountMinor: row.rateAmountMinor, pricingUnit: row.pricingUnit,
      ...(row.cleaningFeeAmountMinor === null ? {} : { cleaningFeeAmountMinor: row.cleaningFeeAmountMinor }),
      ...(row.securityDepositAmountMinor === null ? {} : { securityDepositAmountMinor: row.securityDepositAmountMinor }),
      ...(row.minimumStayNights === null ? {} : { minimumStayNights: row.minimumStayNights }) };
  }
  if (row.commercialKind === "SALE") {
    if (row.salePriceAmountMinor === null) throw new Error("Persisted sale terms are invalid");
    return { kind: "SALE", currency: row.currency, salePriceAmountMinor: row.salePriceAmountMinor,
      ...(row.agencyFeeAmountMinor === null ? {} : { agencyFeeAmountMinor: row.agencyFeeAmountMinor }) };
  }
  throw new Error("Persisted commercial kind is invalid");
}
