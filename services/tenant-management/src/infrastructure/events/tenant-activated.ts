import { createIntegrationEventSchemas, serializeIntegrationEvent } from "@monpiole/events";
import { z } from "zod";

import type { TenantActivatedRecord } from "../../application/activate-tenant.js";

export const tenantActivatedEventType = "monpiole.tenant.tenant-activated";
export const tenantActivatedEventVersion = 1;
export const tenantActivatedPayloadSchema = z.object({
  tenantId: z.uuid(),
  lifecycleState: z.literal("ACTIVE"),
  activatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
});

export const tenantActivatedEventSchemas = createIntegrationEventSchemas({
  eventType: tenantActivatedEventType,
  eventVersion: tenantActivatedEventVersion,
  scope: "tenant",
  payload: tenantActivatedPayloadSchema,
});

export function toTenantActivatedEnvelope(record: TenantActivatedRecord) {
  return tenantActivatedEventSchemas.producer.parse({
    eventId: record.eventId,
    eventType: tenantActivatedEventType,
    eventVersion: tenantActivatedEventVersion,
    occurredAt: record.occurredAt,
    correlationId: record.correlationId,
    producer: "tenant-management",
    tenantId: record.tenantId,
    payload: {
      tenantId: record.tenantId,
      lifecycleState: record.lifecycleState,
      activatedAt: record.activatedAt,
    },
  });
}

export function serializeTenantActivated(record: TenantActivatedRecord): string {
  const bytes = serializeIntegrationEvent(
    tenantActivatedEventSchemas.producer,
    toTenantActivatedEnvelope(record),
    16_384,
  );
  return new TextDecoder().decode(bytes);
}
