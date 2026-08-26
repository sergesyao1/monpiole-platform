import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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
import { useSession } from "./session.js";

const config = {
  issuer: "https://tenant.eu.auth0.com/", domain: "tenant.eu.auth0.com", clientId: "public-client",
  audience: "https://api.monpiole.example", redirectUri: "http://localhost:5173", logoutReturnUri: "http://localhost:5173/connexion",
};

function SessionProbe() {
  const session = useSession();
  return <><span>{session.status}</span><button onClick={() => void session.login()}>login</button><button onClick={() => void session.logout()}>logout</button><button onClick={() => void session.getAccessToken(true)}>token</button></>;
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
    render(<Auth0SessionProvider config={config}><SessionProbe /></Auth0SessionProvider>);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("configure Authorization Code + PKCE via le SDK, l’audience et le cache mémoire", () => {
    render(<Auth0SessionProvider config={config}><SessionProbe /></Auth0SessionProvider>);
    expect(auth0.providerProps).toMatchObject({
      domain: config.domain, clientId: config.clientId, cacheLocation: "memory", useRefreshTokens: true,
      useRefreshTokensFallback: true,
      authorizationParams: { audience: config.audience, redirect_uri: config.redirectUri, scope: "openid profile email offline_access" },
    });
  });

  it("traite le callback et restaure uniquement un chemin local sûr", () => {
    render(<Auth0SessionProvider config={config}><SessionProbe /></Auth0SessionProvider>);
    const onRedirectCallback = auth0.providerProps.onRedirectCallback as (state?: { returnTo?: string }) => void;
    onRedirectCallback({ returnTo: "/proprietaires?onglet=actifs" });
    expect(window.location.pathname + window.location.search).toBe("/proprietaires?onglet=actifs");
    onRedirectCallback({ returnTo: "https://malveillant.example" });
    expect(window.location.pathname).toBe("/");
  });

  it("transmet les destinations de login/logout et force le renouvellement demandé", () => {
    render(<Auth0SessionProvider config={config}><SessionProbe /></Auth0SessionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "login" }));
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    fireEvent.click(screen.getByRole("button", { name: "token" }));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({ appState: { returnTo: "/biens?vue=liste" } });
    expect(auth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: config.logoutReturnUri } });
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({ cacheMode: "off" });
  });
});
