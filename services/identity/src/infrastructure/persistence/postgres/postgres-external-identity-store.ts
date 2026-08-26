import { withPostgresTransaction, withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

import type {
  ExternalIdentityLinkStore, ExternalIdentityResolver, ResolvedExternalIdentityAuthority,
} from "../../../application/external-identity-resolution.js";
import type { ExternalIdentity } from "../../../domain/identity.js";
import { externalIdentities, identities, tenantMemberships } from "./schema.js";

export class ExternalIdentityAlreadyLinkedError extends Error {
  readonly code = "EXTERNAL_IDENTITY_ALREADY_LINKED";
  constructor() { super("External identity is already linked"); this.name = "ExternalIdentityAlreadyLinkedError"; }
}

export class PostgresExternalIdentityStore implements ExternalIdentityResolver, ExternalIdentityLinkStore {
  constructor(private readonly pool: Pool) {}

  async link(externalIdentity: ExternalIdentity): Promise<void> {
    try {
      await withTenantPostgresTransaction(this.pool, externalIdentity.tenantId, async (scope) => {
        await scope.database().insert(externalIdentities).values({
          issuer: externalIdentity.issuer, subject: externalIdentity.subject,
          internalIdentityId: externalIdentity.internalIdentityId,
          tenantId: externalIdentity.tenantId, createdAt: externalIdentity.createdAt,
        });
      });
    } catch (error) {
      if (postgresConstraint(error) === "external_identities_issuer_subject_unique") {
        throw new ExternalIdentityAlreadyLinkedError();
      }
      throw error;
    }
  }

  async resolve(issuer: string, subject: string): Promise<ResolvedExternalIdentityAuthority | undefined> {
    const link = await withPostgresTransaction(this.pool, async (scope) => {
      await scope.query("SELECT set_config('app.external_identity_resolution', 'resolve', true)");
      return (await scope.database().select().from(externalIdentities).where(and(
        eq(externalIdentities.issuer, issuer), eq(externalIdentities.subject, subject),
      )).limit(1))[0];
    });
    if (link === undefined) return undefined;

    return withTenantPostgresTransaction(this.pool, link.tenantId, async (scope) => {
      const row = (await scope.database().select({
        identityId: identities.id, status: identities.status, role: tenantMemberships.role,
        tenantId: tenantMemberships.tenantId,
      }).from(identities).innerJoin(tenantMemberships, and(
        eq(tenantMemberships.identityId, identities.id), eq(tenantMemberships.tenantId, identities.tenantId),
      )).where(and(eq(identities.id, link.internalIdentityId), eq(identities.tenantId, link.tenantId))).limit(1))[0];
      if (row === undefined || row.status !== "ACTIVE" || row.role !== "TENANT_ADMINISTRATOR") return undefined;
      return { identityId: row.identityId, role: row.role, tenantIds: [row.tenantId] };
    });
  }
}

function postgresConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    if ("constraint" in current && typeof current.constraint === "string") return current.constraint;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
