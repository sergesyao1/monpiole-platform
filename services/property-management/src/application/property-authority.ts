export type PropertyGrant = "CREATE_PROPERTY" | "RETRIEVE_PROPERTY" | "LIST_PROPERTIES" | "UPDATE_PROPERTY_DETAILS" | "UPDATE_PROPERTY_CORE_INFORMATION"
  | "CREATE_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNER" | "LIST_PROPERTY_OWNERS" | "UPDATE_PROPERTY_OWNER"
  | "ASSIGN_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNERSHIP" | "REMOVE_PROPERTY_OWNER"
  | "CREATE_PROPERTY_BUILDING" | "RETRIEVE_PROPERTY_COMPOSITION" | "UPDATE_PROPERTY_BUILDING"
  | "CREATE_PROPERTY_UNIT" | "UPDATE_PROPERTY_UNIT_STRUCTURE";

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
