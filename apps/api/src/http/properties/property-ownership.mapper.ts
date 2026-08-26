import type {
  AssignPropertyOwnerCommand, PropertyAuthority, PropertyOwnershipView,
} from "@monpiole/property-management";
import type {
  AssignPropertyOwnerRequest, PropertyOwnershipResponse,
} from "../../contracts/v1/properties/property-ownership.schema.js";

export function toAssignPropertyOwnerCommand(
  propertyId: string, request: AssignPropertyOwnerRequest,
  correlationId: string, authority: PropertyAuthority,
): AssignPropertyOwnerCommand {
  return { propertyId, ...request, correlationId, authority };
}

export function toPropertyOwnershipResponse(ownership: PropertyOwnershipView): PropertyOwnershipResponse {
  return {
    propertyId: ownership.propertyId, ownerId: ownership.ownerId,
    ownershipShare: ownership.ownershipShare, createdAt: ownership.createdAt,
  };
}
