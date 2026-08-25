import { describe, expect, it } from "vitest";
import { parseIntegrationEvent, serializeIntegrationEvent } from "../../packages/events/src/index.js";
import {
  tenantCreatedEventSchemas,
  toTenantCreatedEnvelope,
} from "../../services/tenant-management/src/index.js";

const record = {
  eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  occurredAt: "2026-08-25T12:00:00.000Z",
  lifecycleState: "PENDING" as const,
};

describe("TenantCreated version 1 contract", () => {
  it("produces and serializes the tenant-scoped minimal lifecycle event", () => {
    const event = toTenantCreatedEnvelope(record);
    expect(event).toEqual({
      eventId: record.eventId,
      eventType: "monpiole.tenant.tenant-created",
      eventVersion: 1,
      occurredAt: record.occurredAt,
      correlationId: record.correlationId,
      producer: "tenant-management",
      tenantId: record.tenantId,
      payload: { tenantId: record.tenantId, lifecycleState: "PENDING", createdAt: record.occurredAt },
    });
    const bytes = serializeIntegrationEvent(tenantCreatedEventSchemas.producer, event, 16_384);
    expect(parseIntegrationEvent(tenantCreatedEventSchemas.consumer, bytes, 16_384)).toEqual(event);
    const serialized = new TextDecoder().decode(bytes);
    expect(serialized).not.toMatch(/email|telephone|responsible/i);
  });

  it("allows additive consumer fields but keeps producer output strict", () => {
    const event = toTenantCreatedEnvelope(record);
    expect(tenantCreatedEventSchemas.consumer.safeParse({
      ...event, futureEnvelopeField: true,
      payload: { ...event.payload, futurePayloadField: true },
    }).success).toBe(true);
    expect(tenantCreatedEventSchemas.producer.safeParse({ ...event, futureEnvelopeField: true }).success).toBe(false);
  });
});
