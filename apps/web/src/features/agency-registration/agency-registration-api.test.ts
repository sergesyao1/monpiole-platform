import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { createAgencyRegistrationApi } from "./agency-registration-api.js";

afterEach(() => vi.restoreAllMocks());

describe("AgencyRegistrationApi", () => {
  it("soumet le contrat canonique d'inscription agence via l'API publique", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          status: "SUBMITTED",
          submittedAt: "2026-09-17T12:00:00.000Z",
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const api = createAgencyRegistrationApi();

    const input = {
      agencyLegalName: "Agence Ivoire Immobilier",
      agencyTradeName: "A2I",
      registrationNumber: "CI-ABJ-2026-B-12345",
      taxIdentifier: "CC-1234567",
      phone: "+2250102030405",
      email: "contact@a2i.example",
      website: "https://a2i.example",
      address: "Cocody Riviera",
      city: "Abidjan",
      countryCode: "CI",
      contactFirstName: "Awa",
      contactLastName: "Kone",
      contactEmail: "awa@a2i.example",
      contactPhone: "+2250506070809",
      documents: [
        {
          documentType: "REGISTRATION_CERTIFICATE",
          uploadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      ],
    } as const;

    await expect(api.submitRegistration(input)).resolves.toEqual({
      registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "SUBMITTED",
      submittedAt: "2026-09-17T12:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe(
      "http://localhost:3000/v1/agency-registrations",
    );
    expect(requestInit?.method).toBe("POST");

    const headers = new Headers(requestInit?.headers);

    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);

    expect(JSON.parse(String(requestInit?.body))).toEqual(input);
  });

  it("propage les Problem Details du backend lors de la soumission", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://api.monpiole.example/problems/validation",
          title: "Demande invalide",
          status: 400,
          code: "VALIDATION_ERROR",
          correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );

    const api = createAgencyRegistrationApi();

    await expect(
      api.submitRegistration({
        agencyLegalName: "Agence Test",
        registrationNumber: "CI-TEST-001",
        phone: "+2250102030405",
        email: "contact@example.test",
        address: "Abidjan",
        city: "Abidjan",
        countryCode: "CI",
        contactFirstName: "Jean",
        contactLastName: "Kouassi",
        contactEmail: "jean@example.test",
        contactPhone: "+2250506070809",
        documents: [
          {
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ApiProblem);
  });

  it("upload un justificatif dans le champ multipart file", async () => {
    const responseBody = {
      uploadId: "11111111-1111-4111-8111-111111111111",
      originalFilename: "registre-commerce.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: "2026-09-18T12:00:00.000Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const api = createAgencyRegistrationApi();

    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      "registre-commerce.pdf",
      { type: "application/pdf" },
    );

    await expect(api.uploadDocument(file)).resolves.toEqual(responseBody);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe(
      "http://localhost:3000/v1/agency-registration-documents",
    );
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.body).toBeInstanceOf(FormData);

    const form = requestInit?.body as FormData;
    const uploadedFile = form.get("file");

    expect(uploadedFile).toBeInstanceOf(File);

    if (!(uploadedFile instanceof File)) {
      throw new Error("Expected multipart field 'file' to contain a File.");
    }

    expect(uploadedFile.name).toBe("registre-commerce.pdf");
    expect(uploadedFile.type).toBe("application/pdf");

    const headers = new Headers(requestInit?.headers);

    expect(headers.has("content-type")).toBe(false);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("propage les Problem Details du backend lors de l'upload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://api.monpiole.example/problems/invalid-request",
          title: "Document invalide",
          status: 400,
          code: "INVALID_REQUEST",
          correlationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        }),
        {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );

    const api = createAgencyRegistrationApi();

    const file = new File(
      ["invalid"],
      "document.txt",
      { type: "text/plain" },
    );

    await expect(api.uploadDocument(file)).rejects.toBeInstanceOf(ApiProblem);
  });
});