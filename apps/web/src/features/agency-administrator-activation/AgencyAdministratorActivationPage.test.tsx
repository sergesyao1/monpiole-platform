import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

function session(overrides: Partial<Session> = {}): Session {
  return { status: "authenticated", login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "access-token"), ...overrides };
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ type: "about:blank", title: "Erreur", status, code, correlationId: "correlation" }), { status, headers: { "content-type": "application/problem+json" } });
}

function show(currentSession: Session, token?: string) {
  window.history.replaceState({}, "", token ? `/activation-agence?token=${encodeURIComponent(token)}` : "/activation-agence");
  const router = createMemoryRouter(applicationRoutes, { initialEntries: ["/activation-agence"] });
  return render(<SessionContext.Provider value={currentSession}><RouterProvider router={router} /></SessionContext.Provider>);
}

describe("Activation du premier administrateur", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });

  it("retire immédiatement le secret de l’URL et démarre Auth0 via appState sans stockage persistant", async () => {
    const login = vi.fn(async () => undefined);
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    show(session({ status: "unauthenticated", login }), "bootstrap-secret");
    await waitFor(() => expect(login).toHaveBeenCalledWith("/activation-agence", { activationBootstrapToken: "bootstrap-secret" }));
    expect(window.location.search).toBe("");
    expect(localSet).not.toHaveBeenCalled();
  });

  it("envoie uniquement le bootstrapToken et rend ACTIVE comme un succès convergent", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ registrationId: "a", tenantId: "b", administratorId: "c", role: "TENANT_ADMINISTRATOR", status: "ACTIVE", identityLinkedAt: "2026-09-19T10:00:00.000Z", activatedAt: "2026-09-19T10:00:00.000Z" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    show(session(), "bootstrap-secret");
    expect(await screen.findByRole("heading", { name: "Votre agence est activée" })).toBeVisible();
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({ bootstrapToken: "bootstrap-secret" });
    expect(new Headers((init as RequestInit | undefined)?.headers).get("authorization")).toBe("Bearer access-token");
  });

  it.each([
    [404, "FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_NOT_FOUND", "Lien d’activation invalide"],
    [410, "FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_EXPIRED", "Lien expiré"],
    [409, "FIRST_ADMINISTRATOR_BOOTSTRAP_NOT_COMPLETABLE", "Activation indisponible"],
    [409, "FIRST_ADMINISTRATOR_IDENTITY_LINK_CONFLICT", "Compte non compatible"],
  ])("présente l’erreur %s sans détail sensible", async (status, code, title) => {
    vi.stubGlobal("fetch", vi.fn(async () => problem(status, code)));
    show(session(), "bootstrap-secret");
    expect(await screen.findByRole("heading", { name: title, level: 1 })).toBeVisible();
  });

  it("conserve le secret en mémoire et permet de réessayer après une panne réseau", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(new Response(JSON.stringify({ status: "ACTIVE" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    show(session(), "bootstrap-secret");
    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("heading", { name: "Votre agence est activée" })).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("refuse une route sans invitation", async () => {
    show(session());
    expect(await screen.findByRole("heading", { name: "Lien d’activation invalide", level: 1 })).toBeVisible();
  });
});
