import type {
  PropertyAuthority,
  PropertyAvailabilityView,
  UpdatePropertyAvailabilityCommand,
} from "@monpiole/property-management";

import type {
  PropertyAvailabilityResponse,
  UpdatePropertyAvailabilityRequest,
} from "../../contracts/v1/properties/property-availability.schema.js";

export function toPropertyAvailabilityResponse(view: PropertyAvailabilityView): PropertyAvailabilityResponse {
  return view;
}

export function toUpdatePropertyAvailabilityCommand(
  propertyId: string,
  request: UpdatePropertyAvailabilityRequest,
  correlationId: string,
  authority: PropertyAuthority,
): UpdatePropertyAvailabilityCommand {
  return { propertyId, ...request, correlationId, authority };
}
