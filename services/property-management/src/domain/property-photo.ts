const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_256 = /^[0-9a-f]{64}$/u;

export const PROPERTY_PHOTO_CATEGORIES = [
  "BUILDING_EXTERIOR_OR_ENTRANCE",
  "MAIN_LIVING_SLEEPING_AREA",
  "LIVING_ROOM_OR_MAIN_ROOM",
  "KITCHEN_OR_KITCHENETTE",
  "BEDROOM_OR_SLEEPING_AREA",
  "BATHROOM_OR_SHOWER_ROOM",
  "OTHER",
] as const;
export type PropertyPhotoCategory = typeof PROPERTY_PHOTO_CATEGORIES[number];
export type PropertyPhotoStatus = "AVAILABLE";

export interface PropertyPhotoValues {
  readonly photoId: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly category: PropertyPhotoCategory;
  readonly status: PropertyPhotoStatus;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly contentByteSize: number;
  readonly contentSha256: string;
  readonly isPrimary: boolean;
  readonly registeredAt: string;
  readonly availableAt: string;
}

export interface PropertyPhotoStandardOverride {
  readonly minimumCount: number;
  readonly additionalRequiredCategories: readonly PropertyPhotoCategory[];
}

export interface PropertyPhotoStandardContext {
  readonly propertyType: string;
  readonly transactionType: string;
  readonly apartmentSubtype?: "STUDIO" | "MULTI_ROOM";
}

export interface PropertyPhotoStandard {
  readonly minimumCount: number;
  readonly requiredCategories: readonly PropertyPhotoCategory[];
}

export const MINIMUM_PROPERTY_PHOTO_COUNT = 1;
export const APARTMENT_LONG_TERM_MINIMUM_PHOTO_COUNT = 6;

const STUDIO_REQUIRED_CATEGORIES: readonly PropertyPhotoCategory[] = Object.freeze([
  "BUILDING_EXTERIOR_OR_ENTRANCE",
  "MAIN_LIVING_SLEEPING_AREA",
  "KITCHEN_OR_KITCHENETTE",
  "BATHROOM_OR_SHOWER_ROOM",
]);

const MULTI_ROOM_REQUIRED_CATEGORIES: readonly PropertyPhotoCategory[] = Object.freeze([
  "BUILDING_EXTERIOR_OR_ENTRANCE",
  "LIVING_ROOM_OR_MAIN_ROOM",
  "KITCHEN_OR_KITCHENETTE",
  "BEDROOM_OR_SLEEPING_AREA",
  "BATHROOM_OR_SHOWER_ROOM",
]);

export function resolvePropertyPhotoStandard(
  context: PropertyPhotoStandardContext,
  override?: PropertyPhotoStandardOverride,
): PropertyPhotoStandard {
  const apartmentLongTerm = context.propertyType === "APARTMENT" && context.transactionType === "LONG_TERM_RENTAL";
  const monPioleMinimum = apartmentLongTerm ? APARTMENT_LONG_TERM_MINIMUM_PHOTO_COUNT : MINIMUM_PROPERTY_PHOTO_COUNT;
  const monPioleCategories = !apartmentLongTerm
    ? []
    : context.apartmentSubtype === "STUDIO"
      ? STUDIO_REQUIRED_CATEGORIES
      : context.apartmentSubtype === "MULTI_ROOM"
        ? MULTI_ROOM_REQUIRED_CATEGORIES
        : [];
  const additional = override?.additionalRequiredCategories ?? [];
  return Object.freeze({
    minimumCount: Math.max(monPioleMinimum, override?.minimumCount ?? MINIMUM_PROPERTY_PHOTO_COUNT),
    requiredCategories: Object.freeze([...new Set([...monPioleCategories, ...additional])]),
  });
}

export interface PropertyPhotoReadiness {
  readonly availableCount: number;
  readonly minimumCount: number;
  readonly primaryPhoto?: PropertyPhotoValues;
  readonly categoryCounts: Readonly<Record<PropertyPhotoCategory, number>>;
  readonly missingRequiredCategories: readonly PropertyPhotoCategory[];
}

export function assessPropertyPhotoReadiness(
  photos: readonly PropertyPhotoValues[],
  standard: PropertyPhotoStandard = resolvePropertyPhotoStandard({ propertyType: "OTHER", transactionType: "SALE" }),
): PropertyPhotoReadiness {
  const categoryCounts = Object.fromEntries(PROPERTY_PHOTO_CATEGORIES.map((category) => [category, 0])) as Record<PropertyPhotoCategory, number>;
  const available = photos.filter((photo) => photo.status === "AVAILABLE");
  for (const photo of available) categoryCounts[photo.category] += 1;
  const primary = available.filter((photo) => photo.isPrimary);
  return {
    availableCount: available.length,
    minimumCount: standard.minimumCount,
    ...(primary.length === 1 ? { primaryPhoto: primary[0] } : {}),
    categoryCounts: Object.freeze(categoryCounts),
    missingRequiredCategories: Object.freeze(standard.requiredCategories.filter((category) => categoryCounts[category] === 0)),
  };
}

export function validatePropertyPhotoStandardOverride(value: PropertyPhotoStandardOverride): PropertyPhotoStandardOverride {
  if (!Number.isInteger(value.minimumCount) || value.minimumCount < MINIMUM_PROPERTY_PHOTO_COUNT) {
    throw new InvalidPropertyPhotoStandardError("minimumCount");
  }
  if (value.additionalRequiredCategories.some((category) => !PROPERTY_PHOTO_CATEGORIES.includes(category))) {
    throw new InvalidPropertyPhotoStandardError("additionalRequiredCategories");
  }
  return Object.freeze({
    minimumCount: value.minimumCount,
    additionalRequiredCategories: Object.freeze([...new Set(value.additionalRequiredCategories)]),
  });
}

export function rehydratePropertyPhoto(values: PropertyPhotoValues): PropertyPhotoValues {
  if (!UUID_V4.test(values.photoId) || !UUID_V4.test(values.tenantId) || !UUID_V4.test(values.propertyId)) {
    throw new PersistedPropertyPhotoCorruptionError("identifier");
  }
  if (!PROPERTY_PHOTO_CATEGORIES.includes(values.category) || values.status !== "AVAILABLE") {
    throw new PersistedPropertyPhotoCorruptionError("classification");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(values.contentType)
    || !Number.isSafeInteger(values.contentByteSize) || values.contentByteSize <= 0
    || !SHA_256.test(values.contentSha256)) {
    throw new PersistedPropertyPhotoCorruptionError("content");
  }
  if (!validInstant(values.registeredAt) || !validInstant(values.availableAt)) {
    throw new PersistedPropertyPhotoCorruptionError("availability");
  }
  return Object.freeze({ ...values });
}

export class PersistedPropertyPhotoCorruptionError extends Error {
  constructor(readonly field: string) { super(`Invalid persisted Property photo ${field}`); }
}

export class InvalidPropertyPhotoStandardError extends Error {
  readonly code = "INVALID_PROPERTY_PHOTO_STANDARD";
  constructor(readonly field: "minimumCount" | "additionalRequiredCategories") {
    super(`Invalid Property photo standard ${field}`);
  }
}

export class InvalidPropertyPhotoContentError extends Error {
  readonly code = "INVALID_PROPERTY_PHOTO_CONTENT";
  constructor(readonly field: "contentBase64" | "contentType") {
    super(`Invalid Property photo ${field}`);
  }
}

export class PropertyPhotoNotFoundError extends Error { readonly code = "PROPERTY_PHOTO_NOT_FOUND"; }
export class PropertyPrimaryPhotoDeletionForbiddenError extends Error {
  readonly code = "PROPERTY_PRIMARY_PHOTO_DELETION_FORBIDDEN";
}

function validInstant(value: string) {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
