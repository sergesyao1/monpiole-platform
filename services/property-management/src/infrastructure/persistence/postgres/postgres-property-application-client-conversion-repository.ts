import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { PropertyApplicationClientConversionRepository } from "../../../application/property-application-client-conversion-repository.js";
import { PropertyClient } from "../../../domain/property-client.js";
import { propertyApplicationClientConversions, propertyApplications, propertyClients, propertyInquiries } from "./schema.js";
import { toClient } from "./postgres-property-client-repository.js";

export class PostgresPropertyApplicationClientConversionRepository implements PropertyApplicationClientConversionRepository {
  constructor(private readonly pool: Pool) {}

  convert(input: Parameters<PropertyApplicationClientConversionRepository["convert"]>[0]) {
    return withTenantPostgresTransaction(this.pool, input.tenantId, async (scope) => {
      const database = scope.database();
      const application = (await database.select().from(propertyApplications).where(and(
        eq(propertyApplications.tenantId, input.tenantId), eq(propertyApplications.propertyId, input.propertyId),
        eq(propertyApplications.applicationId, input.applicationId),
      )).limit(1).for("update"))[0];
      if (application === undefined) return { kind: "NOT_FOUND" as const };

      const existing = await this.select(database, input.tenantId, input.applicationId);
      if (existing !== undefined) return { kind: "EXISTING" as const, conversion: existing };
      if (application.status !== "APPROVED") return { kind: "NOT_ELIGIBLE" as const };

      const inquiry = (await database.select().from(propertyInquiries).where(and(
        eq(propertyInquiries.tenantId, input.tenantId), eq(propertyInquiries.propertyId, input.propertyId),
        eq(propertyInquiries.inquiryId, application.inquiryId),
      )).limit(1))[0];
      if (inquiry === undefined) return { kind: "NOT_FOUND" as const };
      const client = PropertyClient.create({
        clientId: input.clientId, tenantId: input.tenantId, displayName: inquiry.contactName,
        ...(inquiry.email === null ? {} : { email: inquiry.email }),
        ...(inquiry.phoneNumber === null ? {} : { phoneNumber: inquiry.phoneNumber }),
        createdAt: input.convertedAt, updatedAt: input.convertedAt,
      });
      await database.insert(propertyClients).values({ ...client.values, email: client.values.email ?? null, phoneNumber: client.values.phoneNumber ?? null, correlationId: input.correlationId, actorId: input.actorId });
      await database.insert(propertyApplicationClientConversions).values({ tenantId: input.tenantId, applicationId: input.applicationId, clientId: input.clientId, convertedAt: input.convertedAt, correlationId: input.correlationId, actorId: input.actorId });
      return { kind: "CREATED" as const, conversion: { applicationId: input.applicationId, convertedAt: input.convertedAt, client } };
    });
  }

  find(tenantId: string, propertyId: string, applicationId: string) {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const application = (await scope.database().select({ applicationId: propertyApplications.applicationId }).from(propertyApplications).where(and(eq(propertyApplications.tenantId, tenantId), eq(propertyApplications.propertyId, propertyId), eq(propertyApplications.applicationId, applicationId))).limit(1))[0];
      return application === undefined ? undefined : this.select(scope.database(), tenantId, applicationId);
    });
  }

  private async select(database: NodePgDatabase<Record<string, never>>, tenantId: string, applicationId: string) {
    const row = (await database.select({ conversion: propertyApplicationClientConversions, client: propertyClients }).from(propertyApplicationClientConversions).innerJoin(propertyClients, and(eq(propertyClients.tenantId, propertyApplicationClientConversions.tenantId), eq(propertyClients.clientId, propertyApplicationClientConversions.clientId))).where(and(eq(propertyApplicationClientConversions.tenantId, tenantId), eq(propertyApplicationClientConversions.applicationId, applicationId))).limit(1))[0];
    return row === undefined ? undefined : { applicationId: row.conversion.applicationId, convertedAt: new Date(row.conversion.convertedAt).toISOString(), client: toClient(row.client) };
  }
}
