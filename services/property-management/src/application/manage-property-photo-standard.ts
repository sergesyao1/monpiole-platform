import {
  validatePropertyPhotoStandardOverride,
  type PropertyPhotoStandardOverride,
} from "../domain/property-photo.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock } from "./create-property.js";
import type { PropertyPhotoStandardRepository } from "./property-photo-standard-repository.js";

export interface PropertyPhotoStandardCommand {
  readonly authority: PropertyAuthority;
}

export class RetrievePropertyPhotoStandard {
  constructor(private readonly standards: PropertyPhotoStandardRepository) {}
  async execute(command: PropertyPhotoStandardCommand): Promise<PropertyPhotoStandardOverride> {
    const tenantId = authorizedTenant(command.authority, "RETRIEVE_PROPERTY_PHOTO_STANDARD");
    return await this.standards.retrieve(tenantId) ?? { minimumCount: 1, additionalRequiredCategories: [] };
  }
}

export class UpdatePropertyPhotoStandard {
  constructor(private readonly standards: PropertyPhotoStandardRepository, private readonly clock: PropertyClock) {}
  async execute(command: PropertyPhotoStandardCommand & PropertyPhotoStandardOverride & {
    readonly correlationId: string;
  }): Promise<PropertyPhotoStandardOverride> {
    const tenantId = authorizedTenant(command.authority, "MANAGE_PROPERTY_PHOTO_STANDARD");
    const standard = validatePropertyPhotoStandardOverride(command);
    await this.standards.save(tenantId, standard, {
      updatedAt: this.clock.now(), correlationId: command.correlationId, actorId: command.authority.actorId,
    });
    return standard;
  }
}
