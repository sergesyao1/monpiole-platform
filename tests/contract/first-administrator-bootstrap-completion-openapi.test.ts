import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface OpenApiSchema {
  readonly type?: string;
  readonly required?: readonly string[];
  readonly properties?: Record<string, OpenApiSchema>;
  readonly additionalProperties?: boolean;
  readonly $ref?: string;
}

interface OpenApiMediaType {
  readonly schema?: OpenApiSchema;
}

interface OpenApiResponse {
  readonly content?: Record<string, OpenApiMediaType>;
}

interface OpenApiOperation {
  readonly operationId?: string;
  readonly security?: readonly Record<string, readonly string[]>[];
  readonly requestBody?: {
    readonly content?: Record<string, OpenApiMediaType>;
  };
  readonly responses?: Record<string, OpenApiResponse>;
}

interface OpenApiPath {
  readonly post?: OpenApiOperation;
}

interface OpenApiDocument {
  readonly paths: Record<string, OpenApiPath>;
  readonly components: {
    readonly schemas: Record<string, OpenApiSchema>;
  };
}

describe("First administrator bootstrap completion OpenAPI", () => {
  const document = JSON.parse(
    readFileSync(
      new URL(
        "../../engineering/contracts/http/openapi.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as OpenApiDocument;

  const operation =
    document.paths[
      "/v1/agency-administrator-bootstrap/completions"
    ]?.post;

  it("exposes the authenticated bootstrap completion operation", () => {
    expect(operation).toBeDefined();

    expect(operation?.operationId).toBe(
      "completeFirstAdministratorIdentity",
    );

    expect(operation?.security).toEqual([
      {
        bearer: [],
      },
    ]);
  });

  it("accepts only the opaque bootstrap token", () => {
    const requestSchema =
      operation?.requestBody?.content?.[
        "application/json"
      ]?.schema;

    expect(requestSchema?.$ref).toBe(
      "#/components/schemas/CompleteFirstAdministratorIdentityRequestDto",
    );

    const schema =
      document.components.schemas[
        "CompleteFirstAdministratorIdentityRequestDto"
      ];

    expect(schema).toBeDefined();
    expect(schema?.type).toBe("object");
    expect(schema?.required).toEqual(["bootstrapToken"]);

    expect(
      Object.keys(schema?.properties ?? {}),
    ).toEqual(["bootstrapToken"]);

    expect(schema?.properties).not.toHaveProperty("tenantId");
    expect(schema?.properties).not.toHaveProperty("administratorId");
    expect(schema?.properties).not.toHaveProperty("issuer");
    expect(schema?.properties).not.toHaveProperty("subject");
    expect(schema?.properties).not.toHaveProperty("role");
  });

  it("publishes the active finalization response contract", () => {
    const responseSchema =
      operation?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema;

    expect(responseSchema?.$ref).toBe(
      "#/components/schemas/CompleteFirstAdministratorIdentityResponseDto",
    );

    const schema =
      document.components.schemas[
        "CompleteFirstAdministratorIdentityResponseDto"
      ];

    expect(schema).toBeDefined();

    expect(schema?.required).toEqual(
      expect.arrayContaining([
        "registrationId",
        "tenantId",
        "administratorId",
        "role",
        "status",
        "identityLinkedAt",
        "activatedAt",
      ]),
    );

    expect(schema?.properties).toHaveProperty("registrationId");
    expect(schema?.properties).toHaveProperty("tenantId");
    expect(schema?.properties).toHaveProperty("administratorId");
    expect(schema?.properties).toHaveProperty("role");
    expect(schema?.properties).toHaveProperty("status");
    expect(schema?.properties).toHaveProperty("identityLinkedAt");
    expect(schema?.properties).toHaveProperty("activatedAt");
  });

  it("documents completion boundary errors", () => {
    expect(operation?.responses).toHaveProperty("400");
    expect(operation?.responses).toHaveProperty("401");
    expect(operation?.responses).toHaveProperty("404");
    expect(operation?.responses).toHaveProperty("409");
    expect(operation?.responses).toHaveProperty("410");
  });
});