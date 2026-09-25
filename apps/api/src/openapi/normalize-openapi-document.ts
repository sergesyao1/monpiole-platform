import type { OpenAPIObject } from "@nestjs/swagger";

function normalizeValue(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeValue(item));
    if (
      (key === "required" || key === "tags" || key === "enum") &&
      normalized.every((item) => typeof item === "string")
    ) {
      return [...normalized].sort((left, right) =>
        String(left).localeCompare(String(right)),
      );
    }
    return normalized;
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const enriched = source["format"] === "uuid" && source["type"] === undefined
      ? { ...source, type: "string" }
      : source;
    return Object.fromEntries(
      Object.entries(enriched)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, entryValue]) => [
          entryKey,
          normalizeValue(entryValue, entryKey),
        ]),
    );
  }
  return value;
}

export function normalizeOpenApiDocument(
  document: OpenAPIObject,
): OpenAPIObject {
  return normalizeValue(document) as OpenAPIObject;
}

export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(normalizeOpenApiDocument(document), null, 2)}\n`;
}
