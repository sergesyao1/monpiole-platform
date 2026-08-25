import { createIntegrationEventSchemas, serializeIntegrationEvent } from "@monpiole/events";
import { z } from "zod";

import type { TenantCreatedRecord } from "../../application/create-tenant.js";

export const tenantCreatedEventType = "monpiole.tenant.tenant-created";
export const tenantCreatedEventVersion = 1;
export const tenantCreatedPayloadSchema = z.object({
  tenantId: z.uuid(),
  lifecycleState: z.literal("PENDING"),
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
});

export const tenantCreatedEventSchemas = createIntegrationEventSchemas({
  eventType: tenantCreatedEventType,
  eventVersion: tenantCreatedEventVersion,
  scope: "tenant",
  payload: tenantCreatedPayloadSchema,
});

export function toTenantCreatedEnvelope(record: TenantCreatedRecord) {
  return tenantCreatedEventSchemas.producer.parse({
    eventId: record.eventId,
    eventType: tenantCreatedEventType,
    eventVersion: tenantCreatedEventVersion,
    occurredAt: record.occurredAt,
    correlationId: record.correlationId,
    producer: "tenant-management",
    tenantId: record.tenantId,
    payload: {
      tenantId: record.tenantId,
      lifecycleState: record.lifecycleState,
      createdAt: record.occurredAt,
    },
  });
}

export function serializeTenantCreated(record: TenantCreatedRecord): string {
  const bytes = serializeIntegrationEvent(
    tenantCreatedEventSchemas.producer,
    toTenantCreatedEnvelope(record),
    16_384,
  );
  return new TextDecoder().decode(bytes);
}
