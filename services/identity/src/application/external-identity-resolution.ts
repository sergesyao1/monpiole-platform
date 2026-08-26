import type { ExternalIdentity } from "../domain/identity.js";

export interface ResolvedExternalIdentityAuthority {
  readonly identityId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly tenantIds: readonly string[];
}

export interface ExternalIdentityResolver {
  resolve(issuer: string, subject: string): Promise<ResolvedExternalIdentityAuthority | undefined>;
}

export interface ExternalIdentityLinkStore {
  link(externalIdentity: ExternalIdentity): Promise<void>;
}
