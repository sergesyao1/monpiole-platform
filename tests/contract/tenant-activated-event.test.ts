import { describe, expect, it } from "vitest";
import {
  tenantActivatedEventSchemas, toTenantActivatedEnvelope,
} from "../../services/tenant-management/src/index.js";
import { serializeTenantActivated } from "../../services/tenant-management/src/infrastructure/events/tenant-activated.js";

const record = {
  eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  occurredAt: "2026-08-25T14:00:00.000Z",
  lifecycleState: "ACTIVE" as const,
  activatedAt: "2026-08-25T14:00:00.000Z",
};

describe("TenantActivated integration event v1", () => {
  it("produces a tenant-scoped canonical envelope without administrator data", () => {
    const envelope = toTenantActivatedEnvelope(record);
    expect(envelope).toMatchObject({
      eventType: "monpiole.tenant.tenant-activated", eventVersion: 1,
      tenantId: record.tenantId, correlationId: record.correlationId,
      payload: { tenantId: record.tenantId, lifecycleState: "ACTIVE", activatedAt: record.activatedAt },
    });
    expect(JSON.stringify(envelope)).not.toMatch(/email|telephone|administrator/i);
  });

  it("is consumable by the v1 consumer schema and serializes deterministically", () => {
    const envelope = toTenantActivatedEnvelope(record);
    expect(tenantActivatedEventSchemas.consumer.parse(envelope)).toMatchObject(envelope);
    expect(JSON.parse(serializeTenantActivated(record))).toEqual(envelope);
  });

  it("allows additive payload evolution for consumers but keeps producers strict", () => {
    const envelope = toTenantActivatedEnvelope(record);
    expect(tenantActivatedEventSchemas.consumer.safeParse({
      ...envelope, payload: { ...envelope.payload, futureField: true },
    }).success).toBe(true);
    expect(tenantActivatedEventSchemas.producer.safeParse({
      ...envelope, payload: { ...envelope.payload, futureField: true },
    }).success).toBe(false);
  });
});
