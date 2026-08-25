import { describe, expect, it } from "vitest";

import {
  syntheticTenantEvent,
  syntheticTenantEventSchemas,
} from "../fixtures/events/synthetic-integration-events.js";

describe("Integration Event additive compatibility", () => {
  it("accepts additive envelope and payload properties for consumers", () => {
    const result = syntheticTenantEventSchemas.consumer.parse({
      ...syntheticTenantEvent,
      additiveEnvelopeField: "future",
      payload: {
        ...syntheticTenantEvent.payload,
        additivePayloadField: "future",
      },
    });

    expect(result).toMatchObject({
      additiveEnvelopeField: "future",
      payload: { additivePayloadField: "future" },
    });
  });

  it("rejects additive properties from producers", () => {
    expect(syntheticTenantEventSchemas.producer.safeParse({
      ...syntheticTenantEvent,
      additiveEnvelopeField: "future",
    }).success).toBe(false);
  });

  it.each([
    ["event type", { ...syntheticTenantEvent, eventType: "monpiole.contract-fixture.changed" }],
    ["event version", { ...syntheticTenantEvent, eventVersion: 2 }],
    ["required payload data", { ...syntheticTenantEvent, payload: { ...syntheticTenantEvent.payload, fixtureId: undefined } }],
    ["changed payload data", { ...syntheticTenantEvent, payload: { ...syntheticTenantEvent.payload, fixtureId: 123 } }],
  ])("rejects incompatible %s", (_name: string, event: unknown) => {
    expect(syntheticTenantEventSchemas.consumer.safeParse(event).success).toBe(false);
  });

  it("maps only known fields into an Application-like value", () => {
    const transport = syntheticTenantEventSchemas.consumer.parse({
      ...syntheticTenantEvent,
      transportOnly: "must-not-leak",
      payload: { ...syntheticTenantEvent.payload, payloadTransportOnly: "must-not-leak" },
    });
    const applicationValue = {
      fixtureId: transport.payload.fixtureId,
      tenantId: transport.tenantId,
      correlationId: transport.correlationId,
    };

    expect(applicationValue).toEqual({
      fixtureId: "fixture-001",
      tenantId: "tenant_fixture",
      correlationId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    });
    expect(applicationValue).not.toHaveProperty("transportOnly");
    expect(applicationValue).not.toHaveProperty("payloadTransportOnly");
  });
});
