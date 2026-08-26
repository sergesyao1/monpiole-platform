import type { CreatePropertyCommand, PropertyAuthority, PropertyView, UpdatePropertyDetailsCommand } from "@monpiole/property-management";
import type { CreatePropertyRequest, PropertyResponse, UpdatePropertyDetailsRequest } from "../../contracts/v1/properties/property.schema.js";

export function toCreatePropertyCommand(request: CreatePropertyRequest, correlationId: string, authority: PropertyAuthority): CreatePropertyCommand {
  return { ...request, correlationId, authority };
}
export function toPropertyResponse(property: PropertyView): PropertyResponse {
  return {
    propertyId: property.propertyId, title: property.title,
    ...(property.description === undefined ? {} : { description: property.description }),
    propertyType: property.propertyType, transactionType: property.transactionType,
    status: property.status, location: property.location,
    createdAt: property.createdAt, updatedAt: property.updatedAt,
    ...(property.details === undefined ? {} : { details: property.details }),
    ...(property.commercialTerms === undefined ? {} : { commercialTerms: property.commercialTerms }),
  };
}

export function toUpdatePropertyDetailsCommand(
  propertyId: string,
  request: UpdatePropertyDetailsRequest,
  correlationId: string,
  authority: PropertyAuthority,
): UpdatePropertyDetailsCommand {
  return { propertyId, ...request, correlationId, authority };
}
