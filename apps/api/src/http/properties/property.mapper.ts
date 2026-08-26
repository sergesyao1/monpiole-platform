import type { CreatePropertyCommand, PropertyAuthority, PropertyView } from "@monpiole/property-management";
import type { CreatePropertyRequest, PropertyResponse } from "../../contracts/v1/properties/property.schema.js";

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
  };
}
