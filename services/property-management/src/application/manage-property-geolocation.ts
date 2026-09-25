import {
  PropertyGeolocation,
  type PropertyGeolocationPublicVisibility,
} from "../domain/property-geolocation.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type {
  PropertyGeolocationMutationTrace,
  PropertyGeolocationRepository,
  PropertyGeolocationResolution,
} from "./property-geolocation-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export type PropertyGeolocationView =
  | Readonly<{ configured: false; source: "OWN" }>
  | Readonly<{ configured: false; source: "INHERITED"; inheritedFromPropertyId: string }>
  | Readonly<{
    configured: true;
    source: "OWN";
    latitude: number;
    longitude: number;
    publicVisibility: PropertyGeolocationPublicVisibility;
  }>
  | Readonly<{
    configured: true;
    source: "INHERITED";
    inheritedFromPropertyId: string;
    latitude: number;
    longitude: number;
    publicVisibility: PropertyGeolocationPublicVisibility;
  }>;

export interface PropertyGeolocationClock {
  now(): string;
}

export interface RetrievePropertyGeolocationQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
}

export interface UpdatePropertyGeolocationCommand extends RetrievePropertyGeolocationQuery {
  readonly correlationId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly publicVisibility: PropertyGeolocationPublicVisibility;
}

export interface RemovePropertyGeolocationCommand extends RetrievePropertyGeolocationQuery {
  readonly correlationId: string;
}

export class RetrievePropertyGeolocation {
  constructor(private readonly repository: PropertyGeolocationRepository) {}

  async execute(query: RetrievePropertyGeolocationQuery): Promise<PropertyGeolocationView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_GEOLOCATION");
    const resolution = await this.repository.findEffective(tenantId, query.propertyId);
    if (resolution === undefined) throw new PropertyNotFoundError();
    return toView(resolution);
  }
}

export class UpdatePropertyGeolocation {
  constructor(
    private readonly repository: PropertyGeolocationRepository,
    private readonly clock: PropertyGeolocationClock,
  ) {}

  async execute(command: UpdatePropertyGeolocationCommand): Promise<PropertyGeolocationView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_GEOLOCATION");
    const geolocation = PropertyGeolocation.create({
      propertyId: command.propertyId,
      tenantId,
      latitude: command.latitude,
      longitude: command.longitude,
      publicVisibility: command.publicVisibility,
    });
    const saved = await this.repository.saveOwn(tenantId, command.propertyId, geolocation, trace(command, this.clock.now()));
    if (saved === undefined) throw new PropertyNotFoundError();
    return toView({ source: "OWN", geolocation: saved });
  }
}

export class RemovePropertyGeolocation {
  constructor(private readonly repository: PropertyGeolocationRepository) {}

  async execute(command: RemovePropertyGeolocationCommand): Promise<void> {
    const tenantId = authorizedTenant(command.authority, "REMOVE_PROPERTY_GEOLOCATION");
    const removed = await this.repository.removeOwn(tenantId, command.propertyId);
    if (removed === undefined) throw new PropertyNotFoundError();
  }
}

function trace(command: UpdatePropertyGeolocationCommand, updatedAt: string): PropertyGeolocationMutationTrace {
  return {
    updatedAt,
    correlationId: command.correlationId,
    actorId: command.authority.actorId,
  };
}

function toView(resolution: PropertyGeolocationResolution): PropertyGeolocationView {
  const { geolocation } = resolution;
  if (geolocation === undefined) {
    return resolution.source === "OWN"
      ? { configured: false, source: "OWN" }
      : { configured: false, source: "INHERITED", inheritedFromPropertyId: resolution.inheritedFromPropertyId };
  }
  const position = {
    configured: true as const,
    latitude: geolocation.values.latitude,
    longitude: geolocation.values.longitude,
    publicVisibility: geolocation.values.publicVisibility,
  };
  return resolution.source === "OWN"
    ? { ...position, source: "OWN" }
    : { ...position, source: "INHERITED", inheritedFromPropertyId: resolution.inheritedFromPropertyId };
}
