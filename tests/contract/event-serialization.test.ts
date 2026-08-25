import { describe, expect, it } from "vitest";

import {
  EventContractError,
  parseIntegrationEvent,
  serializeIntegrationEvent,
} from "../../packages/events/src/index.js";

import {
  syntheticTenantEvent,
  syntheticTenantEventSchemas,
} from "../fixtures/events/synthetic-integration-events.js";

const maxBytes = 4_096;

describe("Integration Event deterministic JSON serialization", () => {
  it("produces identical bytes repeatedly", () => {
    const first = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, syntheticTenantEvent, maxBytes);
    const second = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, syntheticTenantEvent, maxBytes);
    expect(second).toEqual(first);
  });

  it("sorts object keys recursively while preserving array order", () => {
    const reordered = {
      payload: {
        sequence: [3, 1, 2],
        nested: { beta: 2, alpha: "a" },
        fixtureId: "fixture-001",
      },
      tenantId: syntheticTenantEvent.tenantId,
      producer: syntheticTenantEvent.producer,
      causationId: syntheticTenantEvent.causationId,
      correlationId: syntheticTenantEvent.correlationId,
      occurredAt: syntheticTenantEvent.occurredAt,
      eventVersion: syntheticTenantEvent.eventVersion,
      eventType: syntheticTenantEvent.eventType,
      eventId: syntheticTenantEvent.eventId,
    };
    const canonical = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, syntheticTenantEvent, maxBytes);
    const reorderedBytes = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, reordered, maxBytes);
    const json = new TextDecoder().decode(canonical);

    expect(reorderedBytes).toEqual(canonical);
    expect(json.indexOf("\"alpha\"")).toBeLessThan(json.indexOf("\"beta\""));
    expect(JSON.parse(json).payload.sequence).toEqual([3, 1, 2]);
  });

  it("round-trips semantically through UTF-8 JSON", () => {
    const bytes = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, syntheticTenantEvent, maxBytes);
    expect(parseIntegrationEvent(syntheticTenantEventSchemas.consumer, bytes, maxBytes)).toEqual(syntheticTenantEvent);
  });

  it.each([
    ["invalid UTF-8", new Uint8Array([0xc3, 0x28]), "INVALID_UTF8"],
    ["malformed JSON", new TextEncoder().encode("{broken"), "INVALID_JSON"],
    ["primitive root", new TextEncoder().encode("42"), "INVALID_ROOT"],
    ["array root", new TextEncoder().encode("[]"), "INVALID_ROOT"],
  ])("rejects %s", (_name: string, bytes: Uint8Array, code: string) => {
    try {
      parseIntegrationEvent(syntheticTenantEventSchemas.consumer, bytes, maxBytes);
      expect.unreachable("parsing should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EventContractError);
      expect((error as EventContractError).code).toBe(code);
    }
  });

  it("enforces the caller-provided byte limit", () => {
    const bytes = serializeIntegrationEvent(syntheticTenantEventSchemas.producer, syntheticTenantEvent, maxBytes);
    expect(() => parseIntegrationEvent(syntheticTenantEventSchemas.consumer, bytes, bytes.byteLength - 1))
      .toThrowError(expect.objectContaining({ code: "MESSAGE_TOO_LARGE" }));
  });

  it("validates the payload before serialization", () => {
    expect(() => serializeIntegrationEvent(
      syntheticTenantEventSchemas.producer,
      { ...syntheticTenantEvent, payload: { fixtureId: "invalid" } },
      maxBytes,
    )).toThrowError(expect.objectContaining({ code: "INVALID_CONTRACT" }));
  });
});
