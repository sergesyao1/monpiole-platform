import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter, createBrowserRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth0 = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  providerProps: {} as Record<string, unknown>,
  loginWithRedirect: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  getAccessTokenSilently: vi.fn(async () => "access-token"),
}));

vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: (props: Record<string, unknown> & { children: ReactNode }) => {
    auth0.providerProps = props;
    return props.children;
  },
  useAuth0: () => ({
    isLoading: false, isAuthenticated: false, user: undefined, error: undefined,
    loginWithRedirect: auth0.loginWithRedirect, logout: auth0.logout,
    getAccessTokenSilently: auth0.getAccessTokenSilently, ...auth0.state,
  }),
}));

import { Auth0SessionProvider } from "./Auth0SessionProvider.js";
import { managedApplicationRoutes } from "../app/managed-routes.js";
import { useSession } from "./session.js";

const config = {
  issuer: "https://tenant.eu.auth0.com/", domain: "tenant.eu.auth0.com", clientId: "public-client",
  audience: "https://api.monpiole.example", redirectUri: "http://localhost:5173", logoutReturnUri: "http://localhost:5173/connexion",
};

function SessionProbe() {
  const session = useSession();
  return <><span>{session.status}</span><button onClick={() => void session.login()}>login</button><button onClick={() => void session.logout()}>logout</button><button onClick={() => void session.getAccessToken(true)}>token</button></>;
}

function ContinuationProbe() {
  const session = useSession();
  return <><span>{session.loginContinuation?.activationBootstrapToken ?? "none"}</span><button onClick={() => void session.login("/activation-agence", { activationBootstrapToken: "secret-once" })}>activate</button></>;
}

function renderProvider(children: ReactNode) {
  return render(
    <BrowserRouter>
      <Auth0SessionProvider config={config}>{children}</Auth0SessionProvider>
    </BrowserRouter>,
  );
}

describe("frontière de session Auth0", () => {
  beforeEach(() => {
    auth0.state = {};
    auth0.loginWithRedirect.mockClear(); auth0.logout.mockClear(); auth0.getAccessTokenSilently.mockClear();
    window.history.replaceState({}, "", "/biens?vue=liste");
  });

  it.each([
    [{ isLoading: true }, "loading"],
    [{ isAuthenticated: true, user: { name: "Jeanne" } }, "authenticated"],
    [{ isAuthenticated: false }, "unauthenticated"],
    [{ error: new Error("initialisation") }, "error"],
  ])("expose explicitement l’état SDK %o comme %s", (state, expected) => {
    auth0.state = state;
    renderProvider(<SessionProbe />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("configure Authorization Code + PKCE et un cache SDK restaurable dans l’onglet", () => {
    renderProvider(<SessionProbe />);
    expect(auth0.providerProps).toMatchObject({
      domain: config.domain, clientId: config.clientId, useRefreshTokens: true,
      useRefreshTokensFallback: true,
      authorizationParams: { audience: config.audience, redirect_uri: config.redirectUri, scope: "openid profile email offline_access" },
    });
    expect(auth0.providerProps.cache).toMatchObject({
      get: expect.any(Function), set: expect.any(Function), remove: expect.any(Function), allKeys: expect.any(Function),
    });
    expect(auth0.providerProps).not.toHaveProperty("cacheLocation");
  });

  it("traite le callback et restaure uniquement un chemin local sûr", () => {
    renderProvider(<SessionProbe />);
    const onRedirectCallback = auth0.providerProps.onRedirectCallback as (state?: { returnTo?: string }) => void;
    onRedirectCallback({ returnTo: "/proprietaires?onglet=actifs" });
    expect(window.location.pathname + window.location.search).toBe("/proprietaires?onglet=actifs");
    onRedirectCallback({ returnTo: "https://malveillant.example" });
    expect(window.location.pathname).toBe("/");
  });

  it("transmet les destinations de login/logout et force le renouvellement demandé", () => {
    renderProvider(<SessionProbe />);
    fireEvent.click(screen.getByRole("button", { name: "login" }));
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    fireEvent.click(screen.getByRole("button", { name: "token" }));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({ appState: { returnTo: "/biens?vue=liste" } });
    expect(auth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: config.logoutReturnUri } });
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({ cacheMode: "off" });
  });

  it("transporte la continuation d’activation dans appState sans l’ajouter à l’URL", async () => {
    renderProvider(<ContinuationProbe />);
    fireEvent.click(screen.getByRole("button", { name: "activate" }));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({ appState: { returnTo: "/activation-agence", activationBootstrapToken: "secret-once" } });

    const onRedirectCallback = auth0.providerProps.onRedirectCallback as (state?: { returnTo?: string; activationBootstrapToken?: string }) => void;
    onRedirectCallback({ returnTo: "/activation-agence", activationBootstrapToken: "secret-once" });
    expect(await screen.findByText("secret-once")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("synchronise le callback avec les routes gérées et rend l’activation au lieu de l’accueil", async () => {
    auth0.state = { isAuthenticated: true, user: { name: "Administratrice" } };
    window.history.replaceState({}, "", "/");
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      registrationId: "registration-id",
      tenantId: "tenant-id",
      administratorId: "administrator-id",
      role: "TENANT_ADMINISTRATOR",
      status: "ACTIVE",
      identityLinkedAt: "2026-09-24T10:00:00.000Z",
      activatedAt: "2026-09-24T10:00:00.000Z",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    const router = createBrowserRouter(managedApplicationRoutes);

    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { name: "Bienvenue dans votre espace immobilier" })).toBeVisible();

    const onRedirectCallback = auth0.providerProps.onRedirectCallback as (state?: {
      returnTo?: string;
      activationBootstrapToken?: string;
    }) => void;
    act(() => onRedirectCallback({
      returnTo: "/activation-agence",
      activationBootstrapToken: "bootstrap-secret",
    }));

    expect(await screen.findByRole("heading", { name: "Votre agence est activée" })).toBeVisible();
    expect(window.location.pathname).toBe("/activation-agence");
    expect(window.location.search).toBe("");
    const completionCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).includes("/v1/agency-administrator-bootstrap/completions"),
    );
    expect(completionCalls).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/v1/agency-administrator-bootstrap/completions"),
      expect.objectContaining({ method: "POST" }),
    );

    await act(async () => router.navigate("/"));
    await act(async () => router.navigate("/activation-agence"));
    expect(await screen.findByRole("heading", { name: "Lien d’activation invalide", level: 1 })).toBeVisible();
    expect(fetcher.mock.calls.filter(([input]) =>
      String(input).includes("/v1/agency-administrator-bootstrap/completions"),
    )).toHaveLength(1);
  });
});
