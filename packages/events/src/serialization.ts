import type { z } from "zod";

export type EventContractErrorCode =
  | "INVALID_CONTRACT"
  | "INVALID_JSON"
  | "INVALID_ROOT"
  | "INVALID_UTF8"
  | "MESSAGE_TOO_LARGE"
  | "NON_JSON_VALUE";

export class EventContractError extends Error {
  readonly code: EventContractErrorCode;

  constructor(code: EventContractErrorCode, message: string) {
    super(message);
    this.name = "EventContractError";
    this.code = code;
  }
}

type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new EventContractError("NON_JSON_VALUE", "Contract contains a non-JSON object");
    }
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  throw new EventContractError("NON_JSON_VALUE", "Contract contains a non-JSON value");
}

function assertByteLimit(length: number, maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }
  if (length > maxBytes) {
    throw new EventContractError("MESSAGE_TOO_LARGE", "Event exceeds the caller-provided byte limit");
  }
}

export function serializeIntegrationEvent<Output>(
  schema: z.ZodType<Output>,
  input: unknown,
  maxBytes: number,
): Uint8Array {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new EventContractError("INVALID_CONTRACT", "Event does not satisfy its producer contract");
  }
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(result.data)));
  assertByteLimit(bytes.byteLength, maxBytes);
  return bytes;
}

export function parseIntegrationEvent<Output>(
  schema: z.ZodType<Output>,
  bytes: Uint8Array,
  maxBytes: number,
): Output {
  assertByteLimit(bytes.byteLength, maxBytes);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new EventContractError("INVALID_UTF8", "Event is not valid UTF-8");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    throw new EventContractError("INVALID_JSON", "Event is not valid JSON");
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new EventContractError("INVALID_ROOT", "Event JSON root must be an object");
  }

  const result = schema.safeParse(decoded);
  if (!result.success) {
    throw new EventContractError("INVALID_CONTRACT", "Event does not satisfy its consumer contract");
  }
  return result.data;
}
