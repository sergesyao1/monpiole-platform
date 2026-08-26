import type {
  CreatePropertyOwnerCommand, PropertyAuthority, PropertyOwnerIdentity, PropertyOwnerView,
  UpdatePropertyOwnerCommand,
} from "@monpiole/property-management";
import type {
  CreatePropertyOwnerRequest, PropertyOwnerResponse, UpdatePropertyOwnerRequest,
} from "../../contracts/v1/properties/property-owner.schema.js";

export function toCreatePropertyOwnerCommand(
  request: CreatePropertyOwnerRequest, correlationId: string, authority: PropertyAuthority,
): CreatePropertyOwnerCommand {
  return { authority, correlationId, identity: toIdentity(request), contactInformation: toContact(request) };
}

export function toUpdatePropertyOwnerCommand(
  ownerId: string, request: UpdatePropertyOwnerRequest, correlationId: string, authority: PropertyAuthority,
): UpdatePropertyOwnerCommand {
  return { ownerId, authority, correlationId, identity: toIdentity(request), contactInformation: toContact(request) };
}

export function toPropertyOwnerResponse(owner: PropertyOwnerView): PropertyOwnerResponse {
  return {
    ownerId: owner.ownerId, ...owner.identity, ...owner.contactInformation,
    createdAt: owner.createdAt, updatedAt: owner.updatedAt,
  };
}

function toIdentity(request: CreatePropertyOwnerRequest | UpdatePropertyOwnerRequest): PropertyOwnerIdentity {
  return request.ownerType === "INDIVIDUAL"
    ? { ownerType: "INDIVIDUAL", firstName: request.firstName, lastName: request.lastName }
    : {
        ownerType: "LEGAL_ENTITY", legalName: request.legalName,
        ...(request.registrationNumber === undefined ? {} : { registrationNumber: request.registrationNumber }),
      };
}

function toContact(request: CreatePropertyOwnerRequest | UpdatePropertyOwnerRequest) {
  return {
    ...(request.phoneNumber === undefined ? {} : { phoneNumber: request.phoneNumber }),
    ...(request.email === undefined ? {} : { email: request.email }),
  };
}
