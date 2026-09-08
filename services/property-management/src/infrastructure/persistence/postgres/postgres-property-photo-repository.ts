import { createHash, randomUUID } from "node:crypto";
import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import type {
  PropertyPhotoContent,
  PropertyPhotoRegistration,
  PropertyPhotoRepository,
  PropertyPhotoSelectionTrace,
} from "../../../application/property-photo-repository.js";
import {
  assertPublishedPropertyPhotoMutation, InvalidPropertyPhotoContentError,
  PropertyPrimaryPhotoDeletionForbiddenError, rehydratePropertyPhoto, resolvePropertyPhotoStandard,
  validatePropertyPhotoOrder,
  type PropertyPhotoCategory, type PropertyPhotoValues,
} from "../../../domain/property-photo.js";
import { properties, propertyPhotos, propertyPhotoStandards, propertyPrimaryPhotoAudits } from "./schema.js";

export class PostgresPropertyPhotoRepository implements PropertyPhotoRepository {
  constructor(private readonly pool: Pool) {}

  list(tenantId: string, propertyId: string): Promise<readonly PropertyPhotoValues[] | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const property = (await scope.database().select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1))[0];
      if (property === undefined) return undefined;
      return listInScope(scope.database(), tenantId, propertyId);
    });
  }

  register(
    tenantId: string,
    propertyId: string,
    registration: PropertyPhotoRegistration,
  ): Promise<readonly PropertyPhotoValues[] | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const database = scope.database();
      const property = (await database.select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (property === undefined) return undefined;
      const content = persistedContent(registration.contentBase64, registration.contentType);
      const gallery = await listInScope(database, tenantId, propertyId);
      await database.insert(propertyPhotos).values({
        photoId: registration.photoId, tenantId, propertyId, category: registration.category,
        mediaKind: "IMAGE", galleryPosition: gallery.length,
        status: "AVAILABLE", url: null, isPrimary: false,
        contentBase64: content.contentBase64, contentType: content.contentType,
        contentByteSize: content.contentByteSize, contentSha256: content.contentSha256,
        registeredAt: registration.registeredAt, availableAt: registration.registeredAt,
      });
      return listInScope(database, tenantId, propertyId);
    });
  }

  retrieveContent(tenantId: string, propertyId: string, photoId: string): Promise<PropertyPhotoContent | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select({
        contentBase64: propertyPhotos.contentBase64, contentType: propertyPhotos.contentType,
        contentByteSize: propertyPhotos.contentByteSize, contentSha256: propertyPhotos.contentSha256,
      }).from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        eq(propertyPhotos.photoId, photoId), eq(propertyPhotos.status, "AVAILABLE"),
        isNotNull(propertyPhotos.contentBase64), isNotNull(propertyPhotos.galleryPosition),
      )).limit(1))[0];
      if (row?.contentBase64 === null || row?.contentType === null
        || row?.contentByteSize === null || row?.contentSha256 === null) return undefined;
      return {
        contentBase64: row.contentBase64,
        contentType: row.contentType as PropertyPhotoContent["contentType"],
        contentByteSize: row.contentByteSize,
        contentSha256: row.contentSha256,
      };
    });
  }

  selectPrimary(
    tenantId: string,
    propertyId: string,
    photoId: string,
    trace: PropertyPhotoSelectionTrace,
  ): Promise<readonly PropertyPhotoValues[] | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const database = scope.database();
      const property = (await database.select({ propertyId: properties.propertyId, status: properties.status })
        .from(properties).where(and(eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId)))
        .limit(1).for("update"))[0];
      if (property === undefined) return undefined;
      const target = (await database.select({ photoId: propertyPhotos.photoId }).from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        eq(propertyPhotos.photoId, photoId), eq(propertyPhotos.status, "AVAILABLE"),
        isNotNull(propertyPhotos.contentBase64), isNotNull(propertyPhotos.galleryPosition),
      )).limit(1))[0];
      if (target === undefined) return undefined;
      const previous = (await database.select({ photoId: propertyPhotos.photoId }).from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId), eq(propertyPhotos.isPrimary, true),
      )).limit(1))[0];
      if (previous?.photoId === photoId) return listInScope(database, tenantId, propertyId);
      await database.update(propertyPhotos).set({ isPrimary: false }).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId), eq(propertyPhotos.isPrimary, true),
      ));
      await database.update(propertyPhotos).set({ isPrimary: true }).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId), eq(propertyPhotos.photoId, photoId),
      ));
      await database.insert(propertyPrimaryPhotoAudits).values({
        auditId: randomUUID(), tenantId, propertyId, previousPhotoId: previous?.photoId,
        selectedPhotoId: photoId, propertyStatus: property.status,
        selectedAt: trace.selectedAt, correlationId: trace.correlationId, actorId: trace.actorId,
      });
      return listInScope(database, tenantId, propertyId);
    });
  }

  delete(tenantId: string, propertyId: string, photoId: string): Promise<boolean | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const database = scope.database();
      const property = (await database.select({
        propertyId: properties.propertyId, status: properties.status,
        photoStandardVersion: properties.photoStandardVersion, propertyType: properties.propertyType,
        transactionType: properties.transactionType, apartmentSubtype: properties.apartmentSubtype,
      }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (property === undefined) return undefined;
      const photo = (await database.select({
        isPrimary: propertyPhotos.isPrimary, galleryPosition: propertyPhotos.galleryPosition,
      }).from(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        eq(propertyPhotos.photoId, photoId), eq(propertyPhotos.status, "AVAILABLE"),
        isNotNull(propertyPhotos.contentBase64), isNotNull(propertyPhotos.galleryPosition),
      )).limit(1).for("update"))[0];
      if (photo === undefined) return false;
      if (photo.isPrimary) throw new PropertyPrimaryPhotoDeletionForbiddenError();
      const gallery = await listInScope(database, tenantId, propertyId);
      const tenantStandard = (await database.select({
        minimumCount: propertyPhotoStandards.minimumPhotoCount,
        additionalRequiredCategories: propertyPhotoStandards.additionalRequiredCategories,
      }).from(propertyPhotoStandards).where(eq(propertyPhotoStandards.tenantId, tenantId)).limit(1))[0];
      assertPublishedPropertyPhotoMutation(
        property.status,
        property.photoStandardVersion,
        gallery.filter((candidate) => candidate.photoId !== photoId),
        resolvePropertyPhotoStandard({
          propertyType: property.propertyType,
          transactionType: property.transactionType,
          ...(property.apartmentSubtype === null ? {} : { apartmentSubtype: property.apartmentSubtype as "STUDIO" | "MULTI_ROOM" }),
        }, tenantStandard === undefined ? undefined : {
          minimumCount: tenantStandard.minimumCount,
          additionalRequiredCategories: tenantStandard.additionalRequiredCategories as PropertyPhotoCategory[],
        }),
      );
      await database.delete(propertyPhotos).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId), eq(propertyPhotos.photoId, photoId),
      ));
      await compactGalleryAfter(database, tenantId, propertyId, photo.galleryPosition!, gallery.length);
      return true;
    });
  }

  reorder(
    tenantId: string,
    propertyId: string,
    orderedPhotoIds: readonly string[],
  ): Promise<readonly PropertyPhotoValues[] | undefined> {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const database = scope.database();
      const property = (await database.select({ propertyId: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, tenantId), eq(properties.propertyId, propertyId),
      )).limit(1).for("update"))[0];
      if (property === undefined) return undefined;
      const gallery = await listInScope(database, tenantId, propertyId);
      const order = validatePropertyPhotoOrder(gallery, orderedPhotoIds);
      if (gallery.every((photo, position) => photo.photoId === order[position])) return gallery;
      await database.update(propertyPhotos).set({
        galleryPosition: sql`${propertyPhotos.galleryPosition} + ${gallery.length}`,
      }).where(and(
        eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
        isNotNull(propertyPhotos.galleryPosition),
      ));
      for (const [position, orderedPhotoId] of order.entries()) {
        await database.update(propertyPhotos).set({ galleryPosition: position }).where(and(
          eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
          eq(propertyPhotos.photoId, orderedPhotoId),
        ));
      }
      return listInScope(database, tenantId, propertyId);
    });
  }
}

async function listInScope(database: NodePgDatabase, tenantId: string, propertyId: string): Promise<readonly PropertyPhotoValues[]> {
  const rows = await database.select().from(propertyPhotos).where(and(
    eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
    eq(propertyPhotos.status, "AVAILABLE"), isNotNull(propertyPhotos.contentBase64),
    isNotNull(propertyPhotos.galleryPosition),
  )).orderBy(asc(propertyPhotos.galleryPosition), asc(propertyPhotos.photoId));
  return rows.map((row) => rehydratePropertyPhoto({
    photoId: row.photoId, tenantId: row.tenantId, propertyId: row.propertyId,
    mediaKind: row.mediaKind as PropertyPhotoValues["mediaKind"], position: row.galleryPosition!,
    category: row.category as PropertyPhotoCategory, status: "AVAILABLE",
    contentType: row.contentType as PropertyPhotoValues["contentType"],
    contentByteSize: row.contentByteSize!, contentSha256: row.contentSha256!,
    isPrimary: row.isPrimary, registeredAt: new Date(row.registeredAt).toISOString(),
    availableAt: new Date(row.availableAt!).toISOString(),
  }));
}

async function compactGalleryAfter(
  database: NodePgDatabase,
  tenantId: string,
  propertyId: string,
  deletedPosition: number,
  previousLength: number,
): Promise<void> {
  await database.update(propertyPhotos).set({
    galleryPosition: sql`${propertyPhotos.galleryPosition} + ${previousLength}`,
  }).where(and(
    eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
    sql`${propertyPhotos.galleryPosition} > ${deletedPosition}`,
  ));
  await database.update(propertyPhotos).set({
    galleryPosition: sql`${propertyPhotos.galleryPosition} - ${previousLength + 1}`,
  }).where(and(
    eq(propertyPhotos.tenantId, tenantId), eq(propertyPhotos.propertyId, propertyId),
    sql`${propertyPhotos.galleryPosition} > ${deletedPosition + previousLength}`,
  ));
}

function persistedContent(
  contentBase64: string,
  contentType: PropertyPhotoRegistration["contentType"],
): PropertyPhotoContent {
  let bytes: Buffer;
  try { bytes = Buffer.from(contentBase64, "base64"); }
  catch { throw new InvalidPropertyPhotoContentError("contentBase64"); }
  if (bytes.length === 0 || bytes.toString("base64") !== contentBase64 || !matchesSignature(bytes, contentType)) {
    throw new InvalidPropertyPhotoContentError(bytes.length === 0 || bytes.toString("base64") !== contentBase64 ? "contentBase64" : "contentType");
  }
  return {
    contentBase64,
    contentType,
    contentByteSize: bytes.length,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function matchesSignature(bytes: Buffer, contentType: PropertyPhotoRegistration["contentType"]): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}
