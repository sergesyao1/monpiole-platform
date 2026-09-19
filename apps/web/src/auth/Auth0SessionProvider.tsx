import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import { useState, type PropsWithChildren } from "react";

import type { PublicWebConfig } from "../config/public-config.js";
import { SessionContext, type Session, type SessionLoginContinuation } from "./session.js";
import { Auth0SessionStorageCache } from "./Auth0SessionStorageCache.js";

interface Auth0SessionProviderProps extends PropsWithChildren { readonly config: PublicWebConfig["oidc"]; }

const auth0Cache = new Auth0SessionStorageCache();

export function Auth0SessionProvider({ children, config }: Auth0SessionProviderProps) {
  const [loginContinuation, setLoginContinuation] = useState<SessionLoginContinuation>();
  const handleRedirect = (appState?: AppState & SessionLoginContinuation) => {
    setLoginContinuation(readLoginContinuation(appState));
    window.history.replaceState({}, document.title, safeReturnPath(appState?.returnTo));
  };
  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      cache={auth0Cache}
      useRefreshTokens
      useRefreshTokensFallback
      authorizationParams={{ audience: config.audience, redirect_uri: config.redirectUri, scope: "openid profile email offline_access" }}
      onRedirectCallback={handleRedirect}
    >
      <Auth0SessionAdapter logoutReturnUri={config.logoutReturnUri} loginContinuation={loginContinuation}>{children}</Auth0SessionAdapter>
    </Auth0Provider>
  );
}

function Auth0SessionAdapter({ children, logoutReturnUri, loginContinuation }: PropsWithChildren<{ readonly logoutReturnUri: string; readonly loginContinuation?: SessionLoginContinuation }>) {
  const auth0 = useAuth0();
  const session: Session = {
    status: auth0.isLoading ? "loading" : auth0.error !== undefined ? "error" : auth0.isAuthenticated ? "authenticated" : "unauthenticated",
    ...(auth0.user === undefined ? {} : { user: { name: auth0.user.name, email: auth0.user.email } }),
    ...(auth0.error === undefined ? {} : { error: auth0.error }),
    login: async (returnTo, continuation) => auth0.loginWithRedirect({ appState: { returnTo: safeReturnPath(returnTo ?? currentReturnPath()), ...continuation } }),
    ...(loginContinuation === undefined ? {} : { loginContinuation }),
    logout: async () => auth0.logout({ logoutParams: { returnTo: logoutReturnUri } }),
    getAccessToken: async (fresh = false) => auth0.getAccessTokenSilently(fresh ? { cacheMode: "off" } : undefined),
  };
  return <SessionContext value={session}>{children}</SessionContext>;
}

function currentReturnPath(): string { return `${window.location.pathname}${window.location.search}${window.location.hash}`; }
function safeReturnPath(returnTo: unknown): string {
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}

function readLoginContinuation(appState: (AppState & SessionLoginContinuation) | undefined): SessionLoginContinuation | undefined {
  return typeof appState?.activationBootstrapToken === "string" && appState.activationBootstrapToken.length > 0
    ? { activationBootstrapToken: appState.activationBootstrapToken }
    : undefined;
}
