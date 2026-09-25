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

function stubPlatformAgencyRegistrationAuthorization(
  status = 403,
) {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status })),
  );
}

function renderRoute(path = "/", session: Session = authenticatedSession) {
  if (
    session.status === "authenticated" &&
    !vi.isMockFunction(globalThis.fetch)
  ) {
    stubPlatformAgencyRegistrationAuthorization();
  }

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [], pageInfo: { nextCursor: null, hasNextPage: false },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    renderRoute();
    fireEvent.click(screen.getByRole("link", { name: "Biens immobiliers" }));
    expect(await screen.findByRole("heading", { name: "Votre portefeuille immobilier" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Créer un bien" })[0]).toHaveAttribute("href", "/properties/new");
  });

  it("affiche l'administration plateforme seulement après un probe autorisé", async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(new Response(null, { status: 204 })), 0);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderRoute();

    expect(
      screen.queryByText("Administration plateforme"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Inscriptions agences" }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("link", { name: "Inscriptions agences" }),
    ).toHaveAttribute("href", "/plateforme/inscriptions-agences");

    expect(
      screen.getByText("Administration plateforme"),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3000/v1/authentication/authorization/platform-agency-registration-read",
    );

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
  });

  it("masque l'administration plateforme lorsque le probe retourne 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderRoute();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.queryByText("Administration plateforme"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Inscriptions agences" }),
    ).not.toBeInTheDocument();
  });
  it("bloque l'accès direct aux inscriptions agences lorsque le probe retourne 403", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (
          url.endsWith(
            "/v1/authentication/authorization/platform-agency-registration-read",
          )
        ) {
          return new Response(null, { status: 403 });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/plateforme/inscriptions-agences");

    expect(
      await screen.findByText("Accès plateforme non autorisé"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Inscriptions agences" }),
    ).not.toBeInTheDocument();

    const businessRequests = fetchMock.mock.calls.filter(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/platform/agency-registrations",
    );

    expect(businessRequests).toHaveLength(0);

    const probeRequests = fetchMock.mock.calls.filter(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/authentication/authorization/platform-agency-registration-read",
    );

    expect(probeRequests.length).toBeGreaterThanOrEqual(1);
  });

  it("autorise l'accès direct aux inscriptions agences après un probe 204", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (
          url.endsWith(
            "/v1/authentication/authorization/platform-agency-registration-read",
          )
        ) {
          return new Response(null, { status: 204 });
        }

        if (
          url ===
          "http://localhost:3000/v1/platform/agency-registrations"
        ) {
          return new Response(
            JSON.stringify({ items: [] }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/plateforme/inscriptions-agences");

    expect(
      await screen.findByRole("heading", {
        name: "Inscriptions agences",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Aucune inscription agence à examiner."),
    ).toBeInTheDocument();

    const businessRequests = fetchMock.mock.calls.filter(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/platform/agency-registrations",
    );

    expect(businessRequests).toHaveLength(1);

    const probeRequests = fetchMock.mock.calls.filter(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/authentication/authorization/platform-agency-registration-read",
    );

    expect(probeRequests.length).toBeGreaterThanOrEqual(2);
  });
  it("affiche une page 404 utile", () => {
    renderRoute("/route-inconnue");
    expect(screen.getByRole("heading", { name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/");
  });

  it("protège une route lorsque la session est absente", async () => {
    renderRoute("/biens", { ...authenticatedSession, status: "unauthenticated" });
    expect(await screen.findByRole("heading", { name: "Connectez-vous à MonPiole" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Votre portefeuille immobilier" })).not.toBeInTheDocument();
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

  it.each(["loading", "unauthenticated", "error"] as const)(
    "rend le catalogue public et appelle son API avec une session %s sans redirection OIDC",
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        items: [], pageInfo: { nextCursor: null, hasNextPage: false },
      }), { status: 200, headers: { "content-type": "application/json" } }));
      vi.stubGlobal("fetch", fetchMock);
      renderRoute("/catalogue", {
        ...authenticatedSession,
        status,
        ...(status === "error" ? { error: new Error("session failure") } : {}),
      });
      expect(screen.getByRole("heading", { name: "Des biens prêts à accueillir vos projets" })).toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("heading", { name: "Connectez-vous à MonPiole" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "La session n’a pas pu être restaurée" })).not.toBeInTheDocument();
      expect((new Headers(fetchMock.mock.calls[0]?.[1]?.headers)).has("authorization")).toBe(false);
    },
  );

  it("vérifie la chaîne authentifiée vers l’API sans afficher le token", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (
          url.endsWith(
            "/v1/authentication/authorization/platform-agency-registration-read",
          )
        ) {
          return new Response(null, { status: 403 });
        }

        if (url.endsWith("/v1/authentication/session")) {
          return new Response(
            JSON.stringify({ authenticated: true }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/diagnostic-authentification");

    fireEvent.click(
      screen.getByRole("button", { name: "Vérifier ma session API" }),
    );

    expect(
      await screen.findByText(
        "Connexion réussie : l’API reconnaît votre autorité MonPiole.",
      ),
    ).toBeInTheDocument();

    const sessionRequest = fetchMock.mock.calls.find(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/authentication/session",
    );

    expect(sessionRequest).toBeDefined();

    const headers = new Headers(sessionRequest?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(screen.queryByText("test-token")).not.toBeInTheDocument();
  });

  it("distingue un refus métier sans invalider la session", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (
          url.endsWith(
            "/v1/authentication/authorization/platform-agency-registration-read",
          )
        ) {
          return new Response(null, { status: 403 });
        }

        if (
          url.endsWith(
            "/v1/authentication/authorization/platform-tenant-creation",
          )
        ) {
          return new Response(null, { status: 403 });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/diagnostic-authentification");

    fireEvent.click(
      screen.getByRole("button", { name: "Tester le refus 403" }),
    );

    expect(
      await screen.findByText(
        "Votre session reste authentifiée, mais cette opération est interdite.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Session sécurisée")).toBeInTheDocument();

    const authorizationRequest = fetchMock.mock.calls.find(
      ([input]) =>
        String(input) ===
        "http://localhost:3000/v1/authentication/authorization/platform-tenant-creation",
    );

    expect(authorizationRequest).toBeDefined();

    const headers = new Headers(authorizationRequest?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
  });
});
