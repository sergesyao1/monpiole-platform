import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "./routes.js";
import { SessionContext, type Session } from "../auth/session.js";

const authenticatedSession: Session = {
  status: "authenticated", user: { name: "Jeanne Test" },
  login: async () => undefined, logout: async () => undefined,
  getAccessToken: async () => "test-token",
};

function renderRoute(path = "/", session: Session = authenticatedSession) {
  return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} /></SessionContext>);
}

describe("application web MonPiole", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("affiche le shell et l'accueil en français", () => {
    renderRoute();
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bienvenue dans votre espace immobilier" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Biens immobiliers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Propriétaires" })).toBeInTheDocument();
  });

  it("navigue vers le parcours réel de gestion des biens", async () => {
    renderRoute();
    fireEvent.click(screen.getByRole("link", { name: "Biens immobiliers" }));
    expect(await screen.findByRole("heading", { name: "Gérez vos biens depuis leur fiche" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer un bien" })).toHaveAttribute("href", "/properties/new");
  });

  it("affiche une page 404 utile", () => {
    renderRoute("/route-inconnue");
    expect(screen.getByRole("heading", { name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/");
  });

  it("protège une route lorsque la session est absente", async () => {
    renderRoute("/biens", { ...authenticatedSession, status: "unauthenticated" });
    expect(await screen.findByRole("heading", { name: "Connectez-vous à MonPiole" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gérez vos biens depuis leur fiche" })).not.toBeInTheDocument();
  });

  it("attend la restauration de session sans afficher la connexion", () => {
    renderRoute("/biens", { ...authenticatedSession, status: "loading" });
    expect(screen.getByRole("heading", { name: /Chargement de votre espace/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Se connecter" })).not.toBeInTheDocument();
  });

  it("affiche une erreur de restauration explicite", () => {
    renderRoute("/", { ...authenticatedSession, status: "error", error: new Error("failure") });
    expect(screen.getByRole("heading", { name: "La session n’a pas pu être restaurée" })).toBeInTheDocument();
  });

  it("vérifie la chaîne authentifiée vers l’API sans afficher le token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/diagnostic-authentification");
    fireEvent.click(screen.getByRole("button", { name: "Vérifier ma session API" }));
    expect(await screen.findByText("Connexion réussie : l’API reconnaît votre autorité MonPiole.")).toBeInTheDocument();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(screen.queryByText("test-token")).not.toBeInTheDocument();
  });

  it("distingue un refus métier sans invalider la session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 403 })));
    renderRoute("/diagnostic-authentification");
    fireEvent.click(screen.getByRole("button", { name: "Tester le refus 403" }));
    expect(await screen.findByText("Votre session reste authentifiée, mais cette opération est interdite.")).toBeInTheDocument();
    expect(screen.getByText("Session sécurisée")).toBeInTheDocument();
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request?.[0]).toBe("http://localhost:3000/v1/authentication/authorization/platform-tenant-creation");
    expect((request?.[1]?.headers as Headers).get("authorization")).toBe("Bearer test-token");
  });
});
