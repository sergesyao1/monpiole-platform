import type { PropertyPhotoCategory, PropertyPhotoValues } from "../domain/property-photo.js";

export interface PropertyPhotoRegistration {
  readonly photoId: string;
  readonly category: PropertyPhotoCategory;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly contentBase64: string;
  readonly registeredAt: string;
  readonly correlationId: string;
  readonly actorId: string;
}

export interface PropertyPhotoContent {
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly contentBase64: string;
  readonly contentByteSize: number;
  readonly contentSha256: string;
}

export interface PropertyPhotoSelectionTrace {
  readonly correlationId: string;
  readonly actorId: string;
  readonly selectedAt: string;
}

export interface PropertyPhotoRepository {
  list(tenantId: string, propertyId: string): Promise<readonly PropertyPhotoValues[] | undefined>;
  register(
    tenantId: string,
    propertyId: string,
    registration: PropertyPhotoRegistration,
  ): Promise<readonly PropertyPhotoValues[] | undefined>;
  retrieveContent(tenantId: string, propertyId: string, photoId: string): Promise<PropertyPhotoContent | undefined>;
  selectPrimary(
    tenantId: string,
    propertyId: string,
    photoId: string,
    trace: PropertyPhotoSelectionTrace,
  ): Promise<readonly PropertyPhotoValues[] | undefined>;
  delete(tenantId: string, propertyId: string, photoId: string): Promise<boolean | undefined>;
}
