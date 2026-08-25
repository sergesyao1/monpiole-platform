import { z } from "zod";

import { createIntegrationEventSchemas } from "../src/index.js";

export const syntheticEventType = "monpiole.contract-fixture.recorded";
export const syntheticEventVersion = 1;
export const syntheticEventId = "550e8400-e29b-41d4-a716-446655440000";
export const syntheticCorrelationId = "c56a4180-65aa-42ec-a945-5fd21dec0538";
export const syntheticCausationId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
export const syntheticOccurredAt = "2026-08-25T12:34:56.123Z";
export const syntheticTenantId = "tenant_fixture";

export const syntheticPayloadSchema = z.object({
  fixtureId: z.string().min(1),
  nested: z.object({ alpha: z.string(), beta: z.number() }),
  sequence: z.array(z.number()),
});

const definition = {
  eventType: syntheticEventType,
  eventVersion: syntheticEventVersion,
  payload: syntheticPayloadSchema,
} as const;

export const syntheticTenantEventSchemas = createIntegrationEventSchemas({
  ...definition,
  scope: "tenant",
});

export const syntheticPlatformEventSchemas = createIntegrationEventSchemas({
  ...definition,
  scope: "platform",
});

export const syntheticTenantEvent = {
  eventId: syntheticEventId,
  eventType: syntheticEventType,
  eventVersion: syntheticEventVersion,
  occurredAt: syntheticOccurredAt,
  correlationId: syntheticCorrelationId,
  causationId: syntheticCausationId,
  producer: "contract-fixture",
  tenantId: syntheticTenantId,
  payload: {
    fixtureId: "fixture-001",
    nested: { alpha: "a", beta: 2 },
    sequence: [3, 1, 2],
  },
} as const;

export const syntheticPlatformEvent = {
  eventId: "7d444840-9dc0-41d1-b245-5ffdce74fad2",
  eventType: syntheticEventType,
  eventVersion: syntheticEventVersion,
  occurredAt: syntheticOccurredAt,
  correlationId: syntheticCorrelationId,
  producer: "contract-fixture",
  payload: {
    fixtureId: "fixture-platform-001",
    nested: { alpha: "platform", beta: 1 },
    sequence: [1],
  },
} as const;
