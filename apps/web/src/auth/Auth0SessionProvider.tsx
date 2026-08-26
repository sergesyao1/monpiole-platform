import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import type { PropsWithChildren } from "react";

import type { PublicWebConfig } from "../config/public-config.js";
import { SessionContext, type Session } from "./session.js";

interface Auth0SessionProviderProps extends PropsWithChildren { readonly config: PublicWebConfig["oidc"]; }

export function Auth0SessionProvider({ children, config }: Auth0SessionProviderProps) {
  const handleRedirect = (appState?: AppState) => {
    window.history.replaceState({}, document.title, safeReturnPath(appState?.returnTo));
  };
  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      cacheLocation="memory"
      useRefreshTokens
      useRefreshTokensFallback
      authorizationParams={{ audience: config.audience, redirect_uri: config.redirectUri, scope: "openid profile email offline_access" }}
      onRedirectCallback={handleRedirect}
    >
      <Auth0SessionAdapter logoutReturnUri={config.logoutReturnUri}>{children}</Auth0SessionAdapter>
    </Auth0Provider>
  );
}

function Auth0SessionAdapter({ children, logoutReturnUri }: PropsWithChildren<{ readonly logoutReturnUri: string }>) {
  const auth0 = useAuth0();
  const session: Session = {
    status: auth0.isLoading ? "loading" : auth0.error !== undefined ? "error" : auth0.isAuthenticated ? "authenticated" : "unauthenticated",
    ...(auth0.user === undefined ? {} : { user: { name: auth0.user.name, email: auth0.user.email } }),
    ...(auth0.error === undefined ? {} : { error: auth0.error }),
    login: async (returnTo) => auth0.loginWithRedirect({ appState: { returnTo: safeReturnPath(returnTo ?? currentReturnPath()) } }),
    logout: async () => auth0.logout({ logoutParams: { returnTo: logoutReturnUri } }),
    getAccessToken: async (fresh = false) => auth0.getAccessTokenSilently(fresh ? { cacheMode: "off" } : undefined),
  };
  return <SessionContext value={session}>{children}</SessionContext>;
}

function currentReturnPath(): string { return `${window.location.pathname}${window.location.search}${window.location.hash}`; }
function safeReturnPath(returnTo: unknown): string {
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}
