import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, asc, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm";
import type { Pool } from "pg";
import type {
  PropertyCommercialJourneyCriteria,
  PropertyCommercialJourneyCursor,
  PropertyCommercialJourneyItem,
  PropertyCommercialJourneyQuery,
  PropertyCommercialNextAction,
  PropertyCommercialStage,
} from "../../../application/property-commercial-journey-query.js";
import {
  properties, propertyApplicationClientConversions, propertyApplicationContractOrigins,
  propertyApplications, propertyContracts, propertyInquiries, propertyViewingOutcomes, propertyViewings,
} from "./schema.js";

const stageExpression = sql<PropertyCommercialStage>`CASE
  WHEN ${propertyContracts.contractId} IS NOT NULL AND ${propertyContracts.status} = 'DRAFT' THEN 'DRAFT_CONTRACT'
  WHEN ${propertyContracts.contractId} IS NOT NULL AND ${propertyContracts.status} = 'ACTIVE' THEN 'ACTIVE_CONTRACT'
  WHEN ${propertyContracts.contractId} IS NOT NULL AND ${propertyContracts.status} = 'ENDED' THEN 'ENDED_CONTRACT'
  WHEN ${propertyContracts.contractId} IS NOT NULL THEN 'CANCELLED_CONTRACT'
  WHEN ${propertyApplicationClientConversions.applicationId} IS NOT NULL THEN 'CLIENT_CREATED'
  WHEN ${propertyApplications.status} = 'SUBMITTED' THEN 'SUBMITTED_APPLICATION'
  WHEN ${propertyApplications.status} = 'APPROVED' THEN 'APPROVED_APPLICATION'
  WHEN ${propertyApplications.status} = 'REJECTED' THEN 'REJECTED_APPLICATION'
  WHEN ${propertyApplications.status} = 'WITHDRAWN' THEN 'WITHDRAWN_APPLICATION'
  WHEN ${propertyViewingOutcomes.status} = 'FOLLOW_UP_REQUIRED' THEN 'FOLLOW_UP_REQUIRED'
  WHEN ${propertyViewingOutcomes.status} = 'PROCEED' THEN 'PROCEED'
  WHEN ${propertyViewingOutcomes.status} = 'DECLINED' THEN 'DECLINED'
  WHEN ${propertyViewings.status} = 'SCHEDULED' THEN 'SCHEDULED_VIEWING'
  WHEN ${propertyViewings.status} = 'COMPLETED' THEN 'COMPLETED_VIEWING'
  WHEN ${propertyInquiries.status} = 'NEW' THEN 'NEW_INQUIRY'
  WHEN ${propertyInquiries.status} = 'ACKNOWLEDGED' THEN 'ACKNOWLEDGED_INQUIRY'
  ELSE 'CLOSED_INQUIRY' END`;

const nextActionExpression = sql<PropertyCommercialNextAction | null>`CASE
  WHEN ${propertyContracts.status} = 'DRAFT' AND ${propertyContracts.startDate} IS NOT NULL THEN 'ACTIVATE_CONTRACT'
  WHEN ${propertyContracts.contractId} IS NOT NULL THEN NULL
  WHEN ${propertyApplicationClientConversions.applicationId} IS NOT NULL THEN 'CREATE_CONTRACT'
  WHEN ${propertyApplications.status} = 'SUBMITTED' THEN 'DECIDE_APPLICATION'
  WHEN ${propertyApplications.status} = 'APPROVED' THEN 'CREATE_CLIENT'
  WHEN ${propertyApplications.applicationId} IS NOT NULL THEN NULL
  WHEN ${propertyViewingOutcomes.status} = 'FOLLOW_UP_REQUIRED' THEN 'DECIDE_OUTCOME'
  WHEN ${propertyViewingOutcomes.status} = 'PROCEED' THEN 'CREATE_APPLICATION'
  WHEN ${propertyViewingOutcomes.outcomeId} IS NOT NULL THEN NULL
  WHEN ${propertyViewings.status} = 'SCHEDULED' THEN 'COMPLETE_VIEWING'
  WHEN ${propertyViewings.status} = 'COMPLETED' THEN 'RECORD_OUTCOME'
  WHEN ${propertyViewings.viewingId} IS NOT NULL AND ${propertyInquiries.status} <> 'CLOSED' THEN 'SCHEDULE_VIEWING'
  WHEN ${propertyInquiries.status} = 'NEW' THEN 'ACKNOWLEDGE'
  WHEN ${propertyInquiries.status} = 'ACKNOWLEDGED' THEN 'SCHEDULE_VIEWING'
  ELSE NULL END`;

export class PostgresPropertyCommercialJourneyQuery implements PropertyCommercialJourneyQuery {
  constructor(private readonly pool: Pool) {}

  list(tenantId: string, criteria: PropertyCommercialJourneyCriteria, limit: number, cursor?: PropertyCommercialJourneyCursor) {
    return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const search = criteria.q === undefined ? undefined : `%${criteria.q.replace(/[\\%_]/gu, "\\$&")}%`;
      const boundary = cursor === undefined ? undefined : criteria.sort === "OLDEST"
        ? or(gt(propertyInquiries.createdAt, cursor.relevantAt), and(eq(propertyInquiries.createdAt, cursor.relevantAt), gt(propertyInquiries.inquiryId, cursor.inquiryId)))
        : or(lt(propertyInquiries.createdAt, cursor.relevantAt), and(eq(propertyInquiries.createdAt, cursor.relevantAt), lt(propertyInquiries.inquiryId, cursor.inquiryId)));
      const filters = and(
        eq(propertyInquiries.tenantId, tenantId),
        criteria.propertyId ? eq(propertyInquiries.propertyId, criteria.propertyId) : undefined,
        criteria.stage ? eq(stageExpression, criteria.stage) : undefined,
        criteria.nextAction ? eq(nextActionExpression, criteria.nextAction) : undefined,
        search ? or(ilike(propertyInquiries.contactName, search), ilike(propertyInquiries.email, search), ilike(propertyInquiries.phoneNumber, search), ilike(properties.title, search)) : undefined,
      );
      const rows = await scope.database().select({
        inquiry: propertyInquiries, propertyTitle: properties.title, stage: stageExpression,
        nextAction: nextActionExpression,
      }).from(propertyInquiries)
        .innerJoin(properties, and(eq(properties.tenantId, propertyInquiries.tenantId), eq(properties.propertyId, propertyInquiries.propertyId)))
        .leftJoin(propertyViewings, and(eq(propertyViewings.tenantId, propertyInquiries.tenantId), eq(propertyViewings.inquiryId, propertyInquiries.inquiryId)))
        .leftJoin(propertyViewingOutcomes, and(eq(propertyViewingOutcomes.tenantId, propertyViewings.tenantId), eq(propertyViewingOutcomes.viewingId, propertyViewings.viewingId)))
        .leftJoin(propertyApplications, and(eq(propertyApplications.tenantId, propertyInquiries.tenantId), eq(propertyApplications.inquiryId, propertyInquiries.inquiryId)))
        .leftJoin(propertyApplicationClientConversions, and(eq(propertyApplicationClientConversions.tenantId, propertyApplications.tenantId), eq(propertyApplicationClientConversions.applicationId, propertyApplications.applicationId)))
        .leftJoin(propertyApplicationContractOrigins, and(eq(propertyApplicationContractOrigins.tenantId, propertyApplications.tenantId), eq(propertyApplicationContractOrigins.applicationId, propertyApplications.applicationId)))
        .leftJoin(propertyContracts, and(eq(propertyContracts.tenantId, propertyApplicationContractOrigins.tenantId), eq(propertyContracts.contractId, propertyApplicationContractOrigins.contractId)))
        .where(and(filters, boundary))
        .orderBy(criteria.sort === "OLDEST" ? asc(propertyInquiries.createdAt) : desc(propertyInquiries.createdAt), criteria.sort === "OLDEST" ? asc(propertyInquiries.inquiryId) : desc(propertyInquiries.inquiryId))
        .limit(limit + 1);
      const propertiesFilter = await scope.database().select({ propertyId: properties.propertyId, title: properties.title }).from(properties)
        .where(eq(properties.tenantId, tenantId)).orderBy(asc(properties.title), asc(properties.propertyId));
      const countRows = await scope.database().select({ value: sql<number>`count(*)`.mapWith(Number) }).from(propertyInquiries)
          .innerJoin(properties, and(eq(properties.tenantId, propertyInquiries.tenantId), eq(properties.propertyId, propertyInquiries.propertyId)))
          .leftJoin(propertyViewings, and(eq(propertyViewings.tenantId, propertyInquiries.tenantId), eq(propertyViewings.inquiryId, propertyInquiries.inquiryId)))
          .leftJoin(propertyViewingOutcomes, and(eq(propertyViewingOutcomes.tenantId, propertyViewings.tenantId), eq(propertyViewingOutcomes.viewingId, propertyViewings.viewingId)))
          .leftJoin(propertyApplications, and(eq(propertyApplications.tenantId, propertyInquiries.tenantId), eq(propertyApplications.inquiryId, propertyInquiries.inquiryId)))
          .leftJoin(propertyApplicationClientConversions, and(eq(propertyApplicationClientConversions.tenantId, propertyApplications.tenantId), eq(propertyApplicationClientConversions.applicationId, propertyApplications.applicationId)))
          .leftJoin(propertyApplicationContractOrigins, and(eq(propertyApplicationContractOrigins.tenantId, propertyApplications.tenantId), eq(propertyApplicationContractOrigins.applicationId, propertyApplications.applicationId)))
          .leftJoin(propertyContracts, and(eq(propertyContracts.tenantId, propertyApplicationContractOrigins.tenantId), eq(propertyContracts.contractId, propertyApplicationContractOrigins.contractId)))
        .where(filters);
      const totalCount = countRows[0]?.value ?? 0;
      const items = rows.slice(0, limit).map(toItem);
      const last = items.at(-1);
      return {
        items, totalCount: totalCount ?? 0, properties: propertiesFilter,
        ...(rows.length > limit && last ? { nextCursor: { relevantAt: last.relevantAt, inquiryId: last.inquiryId } } : {}),
      };
    });
  }
}

type Row = { inquiry: typeof propertyInquiries.$inferSelect; propertyTitle: string; stage: PropertyCommercialStage; nextAction: PropertyCommercialNextAction | null };
function toItem(row: Row): PropertyCommercialJourneyItem {
  return {
    inquiryId: row.inquiry.inquiryId, propertyId: row.inquiry.propertyId, propertyTitle: row.propertyTitle,
    contactName: row.inquiry.contactName, stage: row.stage, ...(row.nextAction ? { nextAction: row.nextAction } : {}),
    relevantAt: new Date(row.inquiry.createdAt).toISOString(), workspaceAnchor: anchor(row.stage),
  };
}
function anchor(stage: PropertyCommercialStage) {
  if (stage.endsWith("CONTRACT")) return "property-contracts";
  return stage.includes("APPLICATION") || stage === "CLIENT_CREATED" ? "property-applications" : "property-inquiries";
}
