export type PropertyGrant = "CREATE_PROPERTY" | "RETRIEVE_PROPERTY" | "LIST_PROPERTIES" | "UPDATE_PROPERTY_DETAILS" | "UPDATE_PROPERTY_CORE_INFORMATION"
  | "UPDATE_PROPERTY_PRICING"
  | "CREATE_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNER" | "LIST_PROPERTY_OWNERS" | "UPDATE_PROPERTY_OWNER"
  | "ASSIGN_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNERSHIP" | "REMOVE_PROPERTY_OWNER"
  | "CREATE_PROPERTY_BUILDING" | "RETRIEVE_PROPERTY_COMPOSITION" | "UPDATE_PROPERTY_BUILDING"
  | "CREATE_PROPERTY_UNIT" | "UPDATE_PROPERTY_UNIT_STRUCTURE" | "PUBLISH_PROPERTY" | "WITHDRAW_PROPERTY_FROM_CATALOG"
  | "RETRIEVE_PROPERTY_AVAILABILITY" | "UPDATE_PROPERTY_AVAILABILITY"
  | "RETRIEVE_PROPERTY_GEOLOCATION" | "UPDATE_PROPERTY_GEOLOCATION" | "REMOVE_PROPERTY_GEOLOCATION"
  | "CREATE_PROPERTY_PHOTO" | "RETRIEVE_PROPERTY_PHOTOS" | "SELECT_PROPERTY_PRIMARY_PHOTO" | "DELETE_PROPERTY_PHOTO"
  | "RETRIEVE_PROPERTY_PHOTO_STANDARD" | "MANAGE_PROPERTY_PHOTO_STANDARD";

export interface PropertyAuthority {
  readonly actorId: string;
  readonly authorityId: string;
  readonly grants: readonly PropertyGrant[];
  readonly tenantIds: readonly string[];
}

export class PropertyForbiddenError extends Error { readonly code = "PROPERTY_FORBIDDEN"; }

export function authorizedTenant(authority: PropertyAuthority, grant: PropertyGrant): string {
  if (!authority.grants.includes(grant) || authority.tenantIds.length !== 1) throw new PropertyForbiddenError();
  return authority.tenantIds[0]!;
}
