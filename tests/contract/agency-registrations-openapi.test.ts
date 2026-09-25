import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface OpenApiSchema {
  readonly type?: string;
  readonly format?: string;
  readonly required?: readonly string[];
  readonly properties?: Record<string, OpenApiSchema>;
  readonly items?: OpenApiSchema;
  readonly minItems?: number;
  readonly maxItems?: number;
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
  readonly get?: OpenApiOperation;
  readonly post?: OpenApiOperation;
}

interface OpenApiDocument {
  readonly paths: Record<string, OpenApiPath>;
  readonly components: {
    readonly schemas: Record<string, OpenApiSchema>;
  };
}

describe("Agency registrations OpenAPI", () => {
  const document = JSON.parse(
    readFileSync(
      new URL(
        "../../engineering/contracts/http/openapi.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as OpenApiDocument;

  it("exposes the complete agency registration lifecycle", () => {
    expect(document.paths).toHaveProperty(
      "/v1/agency-registration-documents",
    );
    expect(document.paths).toHaveProperty(
      "/v1/agency-registrations",
    );
    expect(document.paths).toHaveProperty(
      "/v1/platform/agency-registrations/{registrationId}",
    );
    expect(document.paths).toHaveProperty(
      "/v1/platform/agency-registrations/{registrationId}/review",
    );
    expect(document.paths).toHaveProperty(
      "/v1/platform/agency-registrations/{registrationId}/reject",
    );
    expect(document.paths).toHaveProperty(
      "/v1/platform/agency-registrations/{registrationId}/approve",
    );
    expect(document.paths).toHaveProperty(
      "/v1/platform/agency-registrations/{registrationId}/first-administrator/reinvitation",
    );
  });

  it("publishes the authenticated bodyless first administrator reinvitation contract", () => {
    const operation = document.paths[
      "/v1/platform/agency-registrations/{registrationId}/first-administrator/reinvitation"
    ]?.post;

    expect(operation?.operationId).toBe(
      "reissueFirstAdministratorBootstrap",
    );
    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(operation?.requestBody).toBeUndefined();
    expect(operation?.responses?.["201"]?.content?.[
      "application/json"
    ]?.schema?.$ref).toBe(
      "#/components/schemas/ReissueFirstAdministratorBootstrapResponseDto",
    );

    const response = document.components.schemas[
      "ReissueFirstAdministratorBootstrapResponseDto"
    ] as OpenApiSchema | undefined;
    expect(response?.required).toEqual(expect.arrayContaining([
      "registrationId",
      "tenantId",
      "administratorId",
      "status",
      "bootstrapToken",
      "bootstrapTokenExpiresAt",
    ]));
    expect(response?.properties).not.toHaveProperty("bootstrapTokenHash");
  });

  it("publishes the public agency document upload contract", () => {
    const operation =
      document.paths[
        "/v1/agency-registration-documents"
      ]?.post;

    expect(operation?.operationId).toBe(
      "uploadAgencyRegistrationDocument",
    );
    expect(operation?.security).toEqual([]);

    const multipart =
      operation?.requestBody?.content?.[
        "multipart/form-data"
      ]?.schema;

    expect(multipart?.type).toBe("object");
    expect(multipart?.required).toContain("file");
    expect(multipart?.properties?.file).toMatchObject({
      type: "string",
      format: "binary",
    });

    const createdResponse =
      operation?.responses?.["201"]?.content?.[
        "application/json"
      ]?.schema;

    expect(createdResponse?.$ref).toBe(
      "#/components/schemas/UploadDocumentResponseDto",
    );

    expect(document.components.schemas).toHaveProperty(
      "UploadDocumentResponseDto",
    );

    const serializedResponseSchema = JSON.stringify(
      document.components.schemas[
        "UploadDocumentResponseDto"
      ],
    );

    expect(serializedResponseSchema).toContain(
      '"uploadId"',
    );
    expect(serializedResponseSchema).toContain(
      '"checksumSha256"',
    );
    expect(serializedResponseSchema).toContain(
      '"expiresAt"',
    );
    expect(serializedResponseSchema).not.toContain(
      '"storageKey"',
    );
  });

  it("publishes submission with staged upload references only", () => {
    const operation =
      document.paths["/v1/agency-registrations"]?.post;

    expect(operation?.operationId).toBe(
      "submitAgencyRegistration",
    );

    expect(operation?.security).toEqual([]);

    const requestSchema =
      operation?.requestBody?.content?.[
        "application/json"
      ]?.schema;

    expect(requestSchema?.$ref).toBe(
      "#/components/schemas/SubmitAgencyRegistrationRequestDto",
    );

    const submitSchema =
      document.components.schemas[
        "SubmitAgencyRegistrationRequestDto"
      ];

    expect(submitSchema).toBeDefined();

    const documentsSchema =
      submitSchema?.properties?.documents;

    expect(documentsSchema?.type).toBe("array");
    expect(documentsSchema?.minItems).toBe(1);
    expect(documentsSchema?.maxItems).toBe(20);

    const documentItemSchema =
      documentsSchema?.items;

    expect(documentItemSchema).toBeDefined();

    const documentItemSchemaName =
      documentItemSchema?.$ref?.split("/").at(-1);

    const resolvedDocumentItemSchema =
      documentItemSchemaName === undefined
        ? documentItemSchema
        : document.components.schemas[
            documentItemSchemaName
          ];

    expect(resolvedDocumentItemSchema).toBeDefined();

    const serializedDocumentItemSchema =
      JSON.stringify(resolvedDocumentItemSchema);

    expect(serializedDocumentItemSchema).toContain(
      '"documentType"',
    );

    expect(serializedDocumentItemSchema).toContain(
      '"uploadId"',
    );

    expect(serializedDocumentItemSchema).not.toContain(
      '"storageKey"',
    );

    expect(serializedDocumentItemSchema).not.toContain(
      '"originalFilename"',
    );

    expect(serializedDocumentItemSchema).not.toContain(
      '"mimeType"',
    );

    expect(serializedDocumentItemSchema).not.toContain(
      '"sizeBytes"',
    );

    expect(serializedDocumentItemSchema).not.toContain(
      '"checksumSha256"',
    );
  });
  it("protects platform retrieval and decision operations with bearer authentication", () => {
    const operations = [
      document.paths["/v1/platform/agency-registrations"]?.get,
      document.paths[
        "/v1/platform/agency-registrations/{registrationId}"
      ]?.get,
      document.paths[
        "/v1/platform/agency-registrations/{registrationId}/review"
      ]?.post,
      document.paths[
        "/v1/platform/agency-registrations/{registrationId}/reject"
      ]?.post,
      document.paths[
        "/v1/platform/agency-registrations/{registrationId}/approve"
      ]?.post,
    ];

    expect(
      operations.map((operation) => operation?.operationId),
    ).toEqual([
      "listAgencyRegistrations",
      "retrieveAgencyRegistration",
      "startAgencyRegistrationReview",
      "rejectAgencyRegistration",
      "approveAgencyRegistration",
    ]);

    for (const operation of operations) {
      expect(operation?.security).toEqual([
        {
          bearer: [],
        },
      ]);
    }
  });

  it("publishes the agency registration response schemas", () => {
    expect(document.components.schemas).toHaveProperty(
      "RegistrationDto",
    );
    expect(document.components.schemas).toHaveProperty(
      "RegistrationListDto",
    );
    expect(document.components.schemas).toHaveProperty(
      "SubmitResponseDto",
    );
    expect(document.components.schemas).toHaveProperty(
      "RejectDto",
    );
  });
});
