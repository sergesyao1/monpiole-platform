import type {
  PropertyAuthority,
  PropertyGeolocationView,
  RemovePropertyGeolocationCommand,
  RetrievePropertyGeolocationQuery,
  UpdatePropertyGeolocationCommand,
} from "@monpiole/property-management";

import type {
  PropertyGeolocationResponse,
  UpdatePropertyGeolocationRequest,
} from "../../contracts/v1/properties/property-geolocation.schema.js";

export function toRetrievePropertyGeolocationQuery(
  propertyId: string,
  authority: PropertyAuthority,
): RetrievePropertyGeolocationQuery {
  return { propertyId, authority };
}

export function toUpdatePropertyGeolocationCommand(
  propertyId: string,
  request: UpdatePropertyGeolocationRequest,
  correlationId: string,
  authority: PropertyAuthority,
): UpdatePropertyGeolocationCommand {
  return { propertyId, ...request, correlationId, authority };
}

export function toRemovePropertyGeolocationCommand(
  propertyId: string,
  correlationId: string,
  authority: PropertyAuthority,
): RemovePropertyGeolocationCommand {
  return { propertyId, correlationId, authority };
}

export function toPropertyGeolocationResponse(view: PropertyGeolocationView): PropertyGeolocationResponse {
  return view;
}
