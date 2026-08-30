import type { PropertyPhotoStandardOverride } from "../domain/property-photo.js";

export interface PropertyPhotoStandardTrace {
  readonly updatedAt: string;
  readonly correlationId: string;
  readonly actorId: string;
}

export interface PropertyPhotoStandardRepository {
  retrieve(tenantId: string): Promise<PropertyPhotoStandardOverride | undefined>;
  save(tenantId: string, standard: PropertyPhotoStandardOverride, trace: PropertyPhotoStandardTrace): Promise<void>;
}
