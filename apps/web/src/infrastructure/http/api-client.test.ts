import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "./api-client.js";
import { ApiProblem } from "./problem-details.js";

afterEach(() => vi.restoreAllMocks());

describe("client HTTP", () => {
  it("traite une réponse JSON et ajoute un identifiant de corrélation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await expect(requestJson<{ ok: boolean }>("/v1/example")).resolves.toEqual({ ok: true });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("transforme un Problem Details sans exposer de détail technique supplémentaire", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      type: "https://api.monpiole.example/problems/not-found",
      title: "Ressource introuvable", status: 404, code: "NOT_FOUND",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }), { status: 404, headers: { "content-type": "application/problem+json" } }));
    await expect(requestJson("/v1/example")).rejects.toBeInstanceOf(ApiProblem);
  });
});
