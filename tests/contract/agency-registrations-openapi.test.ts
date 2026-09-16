import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface OpenApiOperation {
  readonly operationId?: string;
  readonly security?: readonly Record<string, readonly string[]>[];
}

interface OpenApiPath {
  readonly get?: OpenApiOperation;
  readonly post?: OpenApiOperation;
}

interface OpenApiDocument {
  readonly paths: Record<string, OpenApiPath>;
  readonly components: {
    readonly schemas: Record<string, unknown>;
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
      "/v1/agency-registrations",
    );
    expect(document.paths).toHaveProperty(
      "/v1/agency-registrations/{registrationId}",
    );
    expect(document.paths).toHaveProperty(
      "/v1/agency-registrations/{registrationId}/review",
    );
    expect(document.paths).toHaveProperty(
      "/v1/agency-registrations/{registrationId}/reject",
    );
    expect(document.paths).toHaveProperty(
      "/v1/agency-registrations/{registrationId}/approve",
    );
  });

  it("keeps public submission unauthenticated", () => {
    const operation =
      document.paths["/v1/agency-registrations"]?.post;

    expect(operation?.operationId).toBe(
      "submitAgencyRegistration",
    );
    expect(operation?.security).toEqual([]);
  });

  it("protects platform retrieval and decision operations with bearer authentication", () => {
    const operations = [
      document.paths["/v1/agency-registrations"]?.get,
      document.paths[
        "/v1/agency-registrations/{registrationId}"
      ]?.get,
      document.paths[
        "/v1/agency-registrations/{registrationId}/review"
      ]?.post,
      document.paths[
        "/v1/agency-registrations/{registrationId}/reject"
      ]?.post,
      document.paths[
        "/v1/agency-registrations/{registrationId}/approve"
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