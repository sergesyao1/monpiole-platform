export type PropertyGrant = "CREATE_PROPERTY" | "RETRIEVE_PROPERTY" | "UPDATE_PROPERTY_DETAILS"
  | "CREATE_PROPERTY_OWNER" | "RETRIEVE_PROPERTY_OWNER" | "UPDATE_PROPERTY_OWNER";

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
