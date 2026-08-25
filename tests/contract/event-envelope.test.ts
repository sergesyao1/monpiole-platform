import { describe, expect, it } from "vitest";

import {
  syntheticPlatformEvent,
  syntheticPlatformEventSchemas,
  syntheticTenantEvent,
  syntheticTenantEventSchemas,
} from "../fixtures/events/synthetic-integration-events.js";

describe("Integration Event envelope", () => {
  it("accepts valid tenant-scoped and platform-scoped events", () => {
    expect(syntheticTenantEventSchemas.producer.parse(syntheticTenantEvent)).toEqual(syntheticTenantEvent);
    expect(syntheticPlatformEventSchemas.producer.parse(syntheticPlatformEvent)).toEqual(syntheticPlatformEvent);
  });

  it.each([
    ["missing tenantId", { ...syntheticTenantEvent, tenantId: undefined }],
    ["null tenantId", { ...syntheticTenantEvent, tenantId: null }],
    ["missing required eventId", { ...syntheticTenantEvent, eventId: undefined }],
    ["invalid event UUID", { ...syntheticTenantEvent, eventId: "not-a-uuid" }],
    ["nil event UUID", { ...syntheticTenantEvent, eventId: "00000000-0000-0000-0000-000000000000" }],
    ["non-UTC timestamp", { ...syntheticTenantEvent, occurredAt: "2026-08-25T12:34:56+00:00" }],
    ["invalid timestamp", { ...syntheticTenantEvent, occurredAt: "2026-02-30T12:34:56Z" }],
    ["numeric timestamp", { ...syntheticTenantEvent, occurredAt: 1_777_035_296 }],
    ["invalid event type", { ...syntheticTenantEvent, eventType: "ContractFixtureRecorded" }],
    ["zero event version", { ...syntheticTenantEvent, eventVersion: 0 }],
    ["negative event version", { ...syntheticTenantEvent, eventVersion: -1 }],
    ["fractional event version", { ...syntheticTenantEvent, eventVersion: 1.5 }],
  ])("rejects %s", (_name: string, event: unknown) => {
    expect(syntheticTenantEventSchemas.producer.safeParse(event).success).toBe(false);
  });

  it("forbids tenantId on a platform-scoped event", () => {
    expect(syntheticPlatformEventSchemas.producer.safeParse({
      ...syntheticPlatformEvent,
      tenantId: "tenant_fixture",
    }).success).toBe(false);
  });

  it("rejects unknown producer envelope and payload properties", () => {
    expect(syntheticTenantEventSchemas.producer.safeParse({
      ...syntheticTenantEvent,
      unapprovedEnvelopeField: true,
    }).success).toBe(false);
    expect(syntheticTenantEventSchemas.producer.safeParse({
      ...syntheticTenantEvent,
      payload: { ...syntheticTenantEvent.payload, unapprovedPayloadField: true },
    }).success).toBe(false);
  });
});
