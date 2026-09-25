import { withTenantPostgresTransaction } from "@monpiole/persistence";
import {
  and,
  desc,
  eq,
  lt,
  or,
} from "drizzle-orm";
import type { Pool } from "pg";

import type {
  PropertyInquiryCommunicationCursor,
  PropertyInquiryCommunicationPage,
  PropertyInquiryCommunicationRepository,
  RecordPropertyInquiryCommunicationResult,
} from "../../../application/property-inquiry-communication-repository.js";

import {
  PropertyInquiryCommunication,
  type PropertyInquiryCommunicationChannel,
  type PropertyInquiryCommunicationDirection,
  type PropertyInquiryCommunicationStatus,
} from "../../../domain/property-inquiry-communication.js";

import {
  propertyInquiries,
  propertyInquiryCommunications,
} from "./schema.js";

export class PostgresPropertyInquiryCommunicationRepository
  implements PropertyInquiryCommunicationRepository
{
  constructor(private readonly pool: Pool) {}

  record(
    communication: PropertyInquiryCommunication,
    trace: Readonly<{
      correlationId: string;
      actorId: string;
    }>,
  ): Promise<RecordPropertyInquiryCommunicationResult> {
    return withTenantPostgresTransaction(
      this.pool,
      communication.values.tenantId,
      async (scope) => {
        const values = communication.values;

        const inquiry = (
          await scope
            .database()
            .select({
              inquiryId: propertyInquiries.inquiryId,
            })
            .from(propertyInquiries)
            .where(
              and(
                eq(propertyInquiries.tenantId, values.tenantId),
                eq(propertyInquiries.propertyId, values.propertyId),
                eq(propertyInquiries.inquiryId, values.inquiryId),
              ),
            )
            .limit(1)
            .for("update")
        )[0];

        if (!inquiry) {
          return "INQUIRY_NOT_FOUND";
        }

        await scope
          .database()
          .insert(propertyInquiryCommunications)
          .values({
            communicationId: values.communicationId,
            tenantId: values.tenantId,
            propertyId: values.propertyId,
            inquiryId: values.inquiryId,
            channel: values.channel,
            direction: values.direction,
            status: values.status,
            summary: values.summary ?? null,
            occurredAt: values.occurredAt,
            performedByActorId: values.performedByActorId,
            createdAt: values.createdAt,
            correlationId: trace.correlationId,
            actorId: trace.actorId,
          });

        return "CREATED";
      },
    );
  }

  list(
    tenantId: string,
    propertyId: string,
    inquiryId: string,
    limit: number,
    cursor?: PropertyInquiryCommunicationCursor,
  ): Promise<PropertyInquiryCommunicationPage | undefined> {
    return withTenantPostgresTransaction(
      this.pool,
      tenantId,
      async (scope) => {
        const inquiry = (
          await scope
            .database()
            .select({
              inquiryId: propertyInquiries.inquiryId,
            })
            .from(propertyInquiries)
            .where(
              and(
                eq(propertyInquiries.tenantId, tenantId),
                eq(propertyInquiries.propertyId, propertyId),
                eq(propertyInquiries.inquiryId, inquiryId),
              ),
            )
            .limit(1)
        )[0];

        if (!inquiry) {
          return undefined;
        }

        const cursorFilter =
          cursor === undefined
            ? undefined
            : or(
                lt(
                  propertyInquiryCommunications.occurredAt,
                  cursor.occurredAt,
                ),
                and(
                  eq(
                    propertyInquiryCommunications.occurredAt,
                    cursor.occurredAt,
                  ),
                  lt(
                    propertyInquiryCommunications.communicationId,
                    cursor.communicationId,
                  ),
                ),
              );

        const rows = await scope
          .database()
          .select()
          .from(propertyInquiryCommunications)
          .where(
            and(
              eq(propertyInquiryCommunications.tenantId, tenantId),
              eq(propertyInquiryCommunications.propertyId, propertyId),
              eq(propertyInquiryCommunications.inquiryId, inquiryId),
              cursorFilter,
            ),
          )
          .orderBy(
            desc(propertyInquiryCommunications.occurredAt),
            desc(propertyInquiryCommunications.communicationId),
          )
          .limit(limit + 1);

        const items = rows
          .slice(0, limit)
          .map(fromRow);

        const last =
          rows.length > limit
            ? items.at(-1)
            : undefined;

        return {
          items,
          ...(last
            ? {
                nextCursor: {
                  occurredAt: last.values.occurredAt,
                  communicationId:
                    last.values.communicationId,
                },
              }
            : {}),
        };
      },
    );
  }
}

type Row = typeof propertyInquiryCommunications.$inferSelect;

function fromRow(
  row: Row,
): PropertyInquiryCommunication {
  return PropertyInquiryCommunication.rehydrate({
    communicationId: row.communicationId,
    tenantId: row.tenantId,
    propertyId: row.propertyId,
    inquiryId: row.inquiryId,

    channel:
      row.channel as PropertyInquiryCommunicationChannel,

    direction:
      row.direction as PropertyInquiryCommunicationDirection,

    status:
      row.status as PropertyInquiryCommunicationStatus,

    ...(row.summary === null
      ? {}
      : { summary: row.summary }),

    occurredAt: instant(row.occurredAt),
    performedByActorId: row.performedByActorId,
    createdAt: instant(row.createdAt),
  });
}

function instant(value: string): string {
  return new Date(value).toISOString();
}