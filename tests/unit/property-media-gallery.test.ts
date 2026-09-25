import { describe, expect, it, vi } from "vitest";

import {
  assertPublishedPropertyPhotoMutation,
  InvalidPropertyPhotoOrderError,
  PersistedPropertyPhotoCorruptionError,
  PropertyForbiddenError,
  PropertyNotFoundError,
  PropertyPublishedPhotoMutationForbiddenError,
  ReorderPropertyPhotos,
  rehydratePropertyPhoto,
  resolvePropertyPhotoStandard,
  validatePropertyPhotoOrder,
  type PropertyAuthority,
  type PropertyPhotoRepository,
  type PropertyPhotoValues,
} from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PHOTO_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function media(photoId: string, position: number, isPrimary = false): PropertyPhotoValues {
  return {
    photoId, tenantId: TENANT, propertyId: PROPERTY, mediaKind: "IMAGE", position,
    category: position === 0 ? "BUILDING_EXTERIOR_OR_ENTRANCE" : "OTHER",
    status: "AVAILABLE", contentType: "image/png", contentByteSize: 8,
    contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
    isPrimary, registeredAt: "2026-09-08T08:00:00.000Z", availableAt: "2026-09-08T08:00:00.000Z",
  };
}

const gallery = [media(PHOTO_A, 0, true), media(PHOTO_B, 1)];
const authority: PropertyAuthority = {
  actorId: "actor", authorityId: "authority", grants: ["REORDER_PROPERTY_PHOTOS"], tenantIds: [TENANT],
};

function repository(overrides: Partial<PropertyPhotoRepository> = {}): PropertyPhotoRepository {
  return {
    list: vi.fn(async () => gallery), register: vi.fn(), retrieveContent: vi.fn(),
    selectPrimary: vi.fn(), delete: vi.fn(), reorder: vi.fn(async () => [media(PHOTO_B, 0), media(PHOTO_A, 1, true)]),
    ...overrides,
  };
}

describe("Property media gallery domain and application", () => {
  it("rehydrates only positioned IMAGE media", () => {
    expect(rehydratePropertyPhoto(gallery[0]!)).toEqual(gallery[0]);
    expect(() => rehydratePropertyPhoto({ ...gallery[0]!, position: -1 })).toThrow(PersistedPropertyPhotoCorruptionError);
    expect(() => rehydratePropertyPhoto({ ...gallery[0]!, mediaKind: "VIDEO" as never })).toThrow(PersistedPropertyPhotoCorruptionError);
  });

  it("accepts one exact permutation and rejects empty, duplicate, missing or foreign identifiers", () => {
    expect(validatePropertyPhotoOrder(gallery, [PHOTO_B, PHOTO_A])).toEqual([PHOTO_B, PHOTO_A]);
    for (const invalid of [[], [PHOTO_A], [PHOTO_A, PHOTO_A], [PHOTO_A, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]]) {
      expect(() => validatePropertyPhotoOrder(gallery, invalid)).toThrow(InvalidPropertyPhotoOrderError);
    }
  });

  it("authorizes and delegates the complete order, while hiding an unknown Property", async () => {
    const photos = repository();
    await expect(new ReorderPropertyPhotos(photos).execute({ authority, propertyId: PROPERTY, photoIds: [PHOTO_B, PHOTO_A] }))
      .resolves.toMatchObject([{ photoId: PHOTO_B, position: 0 }, { photoId: PHOTO_A, position: 1 }]);
    expect(photos.reorder).toHaveBeenCalledWith(TENANT, PROPERTY, [PHOTO_B, PHOTO_A]);
    await expect(new ReorderPropertyPhotos(repository({ reorder: vi.fn(async () => undefined) })).execute({
      authority, propertyId: PROPERTY, photoIds: [PHOTO_B, PHOTO_A],
    })).rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(new ReorderPropertyPhotos(photos).execute({
      authority: { ...authority, grants: [] }, propertyId: PROPERTY, photoIds: [PHOTO_B, PHOTO_A],
    })).rejects.toBeInstanceOf(PropertyForbiddenError);
  });

  it("allows published mutations only while the established photo standard remains satisfied", () => {
    const standard = resolvePropertyPhotoStandard({ propertyType: "HOUSE", transactionType: "SALE" });
    expect(() => assertPublishedPropertyPhotoMutation("PUBLISHED", 1, [gallery[0]!], standard)).not.toThrow();
    expect(() => assertPublishedPropertyPhotoMutation("PUBLISHED", 1, [], standard))
      .toThrow(PropertyPublishedPhotoMutationForbiddenError);
    expect(() => assertPublishedPropertyPhotoMutation("PUBLISHED", null, [], standard)).not.toThrow();
  });
});
