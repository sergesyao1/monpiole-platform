import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiForbiddenError, ApiSessionExpiredError, createAuthenticatedApiClient, requestJson } from "./api-client.js";
import { ApiProblem } from "./problem-details.js";

afterEach(() => vi.restoreAllMocks());

describe("client HTTP", () => {
  it("traite une réponse JSON et ajoute un identifiant de corrélation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(requestJson<{ ok: boolean }>("/v1/example")).resolves.toEqual({ ok: true });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("transforme un Problem Details sans exposer de détail technique supplémentaire", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      type: "https://api.monpiole.example/problems/not-found", title: "Ressource introuvable", status: 404,
      code: "NOT_FOUND", correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }), { status: 404, headers: { "content-type": "application/problem+json" } }));
    await expect(requestJson("/v1/example")).rejects.toBeInstanceOf(ApiProblem);
  });

  it("ajoute le bearer token aux requêtes authentifiées sans altérer les headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const request = createAuthenticatedApiClient({ getAccessToken: async () => "secret-test-token" });
    await request("/v1/example", { method: "POST", body: { value: 1 }, headers: { "x-custom": "value" } });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer secret-test-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-custom")).toBe("value");
  });

  it("ne joint aucun token à une requête publique", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await requestJson("/v1/public");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("renouvelle une seule fois après 401 puis signale une session expirée", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const getAccessToken = vi.fn(async (fresh?: boolean) => fresh ? "fresh-token" : "cached-token");
    const request = createAuthenticatedApiClient({ getAccessToken });
    await expect(request("/v1/example")).rejects.toBeInstanceOf(ApiSessionExpiredError);
    expect(getAccessToken.mock.calls).toEqual([[], [true]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("distingue 403 sans renouveler ni déconnecter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
    const getAccessToken = vi.fn(async () => "valid-token");
    const request = createAuthenticatedApiClient({ getAccessToken });
    await expect(request("/v1/example")).rejects.toBeInstanceOf(ApiForbiddenError);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it("n’expose pas le token dans l’erreur et ne le journalise pas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = createAuthenticatedApiClient({ getAccessToken: async () => "bearer-ne-doit-pas-fuiter" });
    const error = await request("/v1/example").catch((caught: unknown) => caught);
    expect(String(error)).not.toContain("bearer-ne-doit-pas-fuiter");
    expect(log).not.toHaveBeenCalled();
  });
});
