import { afterEach, describe, expect, it, vi } from "vitest";

import { createPlatformAgencyRegistrationApi } from "./platform-agency-registration-api.js";

afterEach(() => vi.restoreAllMocks());

function createTokens() {
  return {
    getAccessToken: vi.fn().mockResolvedValue("platform-access-token"),
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("PlatformAgencyRegistrationApi", () => {
  it("liste les demandes avec authentification plateforme", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          items: [],
        }),
      );

    const tokens = createTokens();
    const api = createPlatformAgencyRegistrationApi(tokens);

    await expect(api.listRegistrations()).resolves.toEqual({
      items: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "http://localhost:3000/v1/platform/agency-registrations",
    );

    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer platform-access-token",
    );
  });

  it("récupère le détail d'une demande", async () => {
    const registrationId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const response = {
      registrationId,
      status: "SUBMITTED",
      agencyLegalName: "Agence Ivoire Immobilier",
      registrationNumber: "CI-ABJ-2026-B-12345",
      phone: "+2250102030405",
      email: "contact@example.test",
      address: "Cocody Riviera",
      city: "Abidjan",
      countryCode: "CI",
      contactFirstName: "Awa",
      contactLastName: "Kone",
      contactEmail: "awa@example.test",
      contactPhone: "+2250506070809",
      submittedAt: "2026-09-17T12:00:00.000Z",
      correlationId: "correlation-1",
      createdAt: "2026-09-17T12:00:00.000Z",
      updatedAt: "2026-09-17T12:00:00.000Z",
      documents: [],
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(response));

    const api = createPlatformAgencyRegistrationApi(createTokens());

    await expect(
      api.retrieveRegistration(registrationId),
    ).resolves.toEqual(response);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `http://localhost:3000/v1/platform/agency-registrations/${registrationId}`,
    );
  });

  it("démarre la revue d'une demande", async () => {
    const registrationId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          registrationId,
          status: "UNDER_REVIEW",
        }),
      );

    const api = createPlatformAgencyRegistrationApi(createTokens());

    await api.startReview(registrationId);

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      `http://localhost:3000/v1/platform/agency-registrations/${registrationId}/review`,
    );
    expect(init?.method).toBe("POST");
  });

  it("rejette une demande avec le motif canonique", async () => {
    const registrationId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          registrationId,
          status: "REJECTED",
          rejectionReason: "Justificatif incomplet",
        }),
      );

    const api = createPlatformAgencyRegistrationApi(createTokens());

    await api.rejectRegistration(registrationId, {
      rejectionReason: "Justificatif incomplet",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      `http://localhost:3000/v1/platform/agency-registrations/${registrationId}/reject`,
    );
    expect(init?.method).toBe("POST");

    expect(JSON.parse(String(init?.body))).toEqual({
      rejectionReason: "Justificatif incomplet",
    });
  });

  it("approuve une demande", async () => {
    const registrationId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          registrationId,
          status: "APPROVED",
        }),
      );

    const api = createPlatformAgencyRegistrationApi(createTokens());

    await api.approveRegistration(registrationId);

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      `http://localhost:3000/v1/platform/agency-registrations/${registrationId}/approve`,
    );
    expect(init?.method).toBe("POST");
  });

  it("télécharge un justificatif avec authentification", async () => {
    const registrationId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const documentId =
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(new Blob(["document"]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
          },
        }),
      );

    const api = createPlatformAgencyRegistrationApi(createTokens());

    const result = await api.downloadDocument(
      registrationId,
      documentId,
    );

    expect(result).toBeInstanceOf(Blob);

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      `http://localhost:3000/v1/platform/agency-registrations/${registrationId}/documents/${documentId}/content`,
    );

    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer platform-access-token",
    );
  });
});