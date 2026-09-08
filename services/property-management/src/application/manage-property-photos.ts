import {
  PropertyPhotoNotFoundError,
  type PropertyPhotoCategory,
  type PropertyPhotoValues,
} from "../domain/property-photo.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock, PropertyIdentifierGenerator } from "./create-property.js";
import type { PropertyPhotoContent, PropertyPhotoRepository } from "./property-photo-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export interface PropertyPhotoCommand {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
}

export class ListPropertyPhotos {
  constructor(private readonly photos: PropertyPhotoRepository) {}
  async execute(query: PropertyPhotoCommand): Promise<readonly PropertyPhotoValues[]> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_PHOTOS");
    const result = await this.photos.list(tenantId, query.propertyId);
    if (result === undefined) throw new PropertyNotFoundError();
    return result;
  }
}

export class RegisterPropertyPhoto {
  constructor(
    private readonly photos: PropertyPhotoRepository,
    private readonly identifiers: PropertyIdentifierGenerator,
    private readonly clock: PropertyClock,
  ) {}
  async execute(command: PropertyPhotoCommand & {
    readonly correlationId: string;
    readonly category: PropertyPhotoCategory;
    readonly contentType: "image/jpeg" | "image/png" | "image/webp";
    readonly contentBase64: string;
  }): Promise<readonly PropertyPhotoValues[]> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_PHOTO");
    const result = await this.photos.register(tenantId, command.propertyId, {
      photoId: this.identifiers.generate(), category: command.category,
      contentType: command.contentType, contentBase64: command.contentBase64,
      registeredAt: this.clock.now(), correlationId: command.correlationId,
      actorId: command.authority.actorId,
    });
    if (result === undefined) throw new PropertyNotFoundError();
    return result;
  }
}

export class RetrievePropertyPhotoContent {
  constructor(private readonly photos: PropertyPhotoRepository) {}
  async execute(command: PropertyPhotoCommand & { readonly photoId: string }): Promise<PropertyPhotoContent> {
    const tenantId = authorizedTenant(command.authority, "RETRIEVE_PROPERTY_PHOTOS");
    const result = await this.photos.retrieveContent(tenantId, command.propertyId, command.photoId);
    if (result === undefined) throw new PropertyPhotoNotFoundError();
    return result;
  }
}

export class SelectPropertyPrimaryPhoto {
  constructor(private readonly photos: PropertyPhotoRepository, private readonly clock: PropertyClock) {}
  async execute(command: PropertyPhotoCommand & { readonly photoId: string; readonly correlationId: string }): Promise<readonly PropertyPhotoValues[]> {
    const tenantId = authorizedTenant(command.authority, "SELECT_PROPERTY_PRIMARY_PHOTO");
    const result = await this.photos.selectPrimary(tenantId, command.propertyId, command.photoId, {
      correlationId: command.correlationId, actorId: command.authority.actorId, selectedAt: this.clock.now(),
    });
    if (result === undefined) throw new PropertyPhotoNotFoundError();
    return result;
  }
}

export class DeletePropertyPhoto {
  constructor(private readonly photos: PropertyPhotoRepository) {}
  async execute(command: PropertyPhotoCommand & { readonly photoId: string }): Promise<void> {
    const tenantId = authorizedTenant(command.authority, "DELETE_PROPERTY_PHOTO");
    const deleted = await this.photos.delete(tenantId, command.propertyId, command.photoId);
    if (deleted === undefined || !deleted) throw new PropertyPhotoNotFoundError();
  }
}

export class ReorderPropertyPhotos {
  constructor(private readonly photos: PropertyPhotoRepository) {}
  async execute(command: PropertyPhotoCommand & { readonly photoIds: readonly string[] }): Promise<readonly PropertyPhotoValues[]> {
    const tenantId = authorizedTenant(command.authority, "REORDER_PROPERTY_PHOTOS");
    const reordered = await this.photos.reorder(tenantId, command.propertyId, command.photoIds);
    if (reordered === undefined) throw new PropertyNotFoundError();
    return reordered;
  }
}
