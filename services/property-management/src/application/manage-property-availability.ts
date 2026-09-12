import {
  PropertyAvailabilityDerivedFromUnitsError,
  type PropertyAvailabilityStatus,
  type PropertyOccupancyStatus,
} from "../domain/property.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClock } from "./create-property.js";
import type {
  DirectPropertyAvailability,
  PropertyAvailabilityQuery,
  PropertyAvailabilityReadModel,
} from "./property-availability-query.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export type PropertyAvailabilityView =
  | (DirectPropertyAvailability & Readonly<{ canUpdateAvailability: boolean }>)
  | (Exclude<PropertyAvailabilityReadModel, DirectPropertyAvailability> & Readonly<{ canUpdateAvailability: false }>);

export interface RetrievePropertyAvailabilityQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
}

export interface UpdatePropertyAvailabilityCommand extends RetrievePropertyAvailabilityQuery {
  readonly correlationId: string;
  readonly availabilityStatus: PropertyAvailabilityStatus;
  readonly occupancyStatus: PropertyOccupancyStatus;
}

export class RetrievePropertyAvailability {
  constructor(private readonly query: PropertyAvailabilityQuery) {}

  async execute(request: RetrievePropertyAvailabilityQuery): Promise<PropertyAvailabilityView> {
    const tenantId = authorizedTenant(request.authority, "RETRIEVE_PROPERTY_AVAILABILITY");
    const availability = await this.query.retrieve(tenantId, request.propertyId);
    if (availability === undefined) throw new PropertyNotFoundError();
    if (availability.source === "DERIVED_FROM_UNITS") {
      return { ...availability, canUpdateAvailability: false };
    }
    return {
      ...availability,
      canUpdateAvailability: request.authority.grants.includes("UPDATE_PROPERTY_AVAILABILITY")
        && request.authority.tenantIds.length === 1
        && request.authority.tenantIds[0] === tenantId,
    };
  }
}

export class UpdatePropertyAvailability {
  constructor(private readonly repository: PropertyRepository, private readonly clock: PropertyClock) {}

  async execute(command: UpdatePropertyAvailabilityCommand): Promise<PropertyAvailabilityView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_AVAILABILITY");
    const property = await this.repository.updateAtomically(
      tenantId,
      command.propertyId,
      (current) => {
        if (current.values.structuralRole === "COMPOSITE" && current.values.commercializationMode !== "WHOLE_BUILDING") {
          throw new PropertyAvailabilityDerivedFromUnitsError();
        }
        if (current.values.availability?.availabilityStatus === command.availabilityStatus
          && current.values.availability.occupancyStatus === command.occupancyStatus) return current;
        return current.defineAvailability(command.availabilityStatus, command.occupancyStatus, this.clock.now());
      },
      { correlationId: command.correlationId, actorId: command.authority.actorId },
    );
    if (property === undefined) throw new PropertyNotFoundError();
    if (property.values.availability === undefined) {
      throw new Error("Updated direct Property availability is unavailable");
    }
    return {
      propertyId: property.values.propertyId,
      source: "DIRECT",
      structuralRole: property.values.structuralRole,
      configured: true,
      ...property.values.availability,
      canUpdateAvailability: true,
    };
  }
}
