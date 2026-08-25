import { z } from "zod";

import {
  causationIdSchema,
  correlationIdSchema,
  eventIdSchema,
  eventTypeSchema,
  eventVersionSchema,
  occurredAtSchema,
  producerSchema,
  tenantIdSchema,
} from "./identifiers.js";

export type EventScope = "platform" | "tenant";

export interface IntegrationEventContractDefinition<
  PayloadSchema extends z.ZodObject,
> {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly payload: PayloadSchema;
  readonly scope: EventScope;
}

const commonEnvelopeShape = {
  eventId: eventIdSchema,
  occurredAt: occurredAtSchema,
  correlationId: correlationIdSchema,
  causationId: causationIdSchema.optional(),
  producer: producerSchema,
};

export function createIntegrationEventSchemas<
  PayloadSchema extends z.ZodObject,
>(definition: IntegrationEventContractDefinition<PayloadSchema>) {
  const eventType = eventTypeSchema.parse(definition.eventType);
  const eventVersion = eventVersionSchema.parse(definition.eventVersion);
  const tenantShape = definition.scope === "tenant"
    ? { tenantId: tenantIdSchema }
    : { tenantId: z.never().optional() };

  const envelopeShape = {
    ...commonEnvelopeShape,
    ...tenantShape,
    eventType: z.literal(eventType),
    eventVersion: z.literal(eventVersion),
  };

  return {
    consumer: z.object({
      ...envelopeShape,
      payload: definition.payload.loose(),
    }).loose(),
    producer: z.object({
      ...envelopeShape,
      payload: definition.payload.strict(),
    }).strict(),
  } as const;
}
