import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Property commercial journeys OpenAPI", () => {
  it("publishes tenant-scoped search, filters, sorting and result metadata", () => {
    const document = JSON.parse(readFileSync(new URL("../../engineering/contracts/http/openapi.json", import.meta.url), "utf8")) as {
      paths: Record<string, { get?: { parameters?: readonly { name: string }[]; responses?: unknown } }>;
      components: { schemas: Record<string, unknown> };
    };
    const operation = document.paths["/v1/property-commercial-journeys"]?.get;
    expect(operation).toBeDefined();
    expect(operation?.parameters?.map(parameter => parameter.name)).toEqual(expect.arrayContaining(["q", "propertyId", "stage", "nextAction", "sort", "limit", "cursor"]));
    const responseSchema = JSON.stringify(document.components.schemas.PropertyCommercialJourneyListResponseDto);
    expect(responseSchema).toContain('"totalCount"');
    expect(responseSchema).toContain('"properties"');
    expect(responseSchema).not.toContain('"tenantId"');
  });
});
