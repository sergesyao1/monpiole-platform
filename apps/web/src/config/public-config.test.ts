import { describe, expect, it } from "vitest";

import { readPublicWebConfig } from "./public-config.js";

describe("configuration publique web", () => {
  const validEnvironment = {
    VITE_API_BASE_URL: "https://api.example.com/",
    VITE_OIDC_ISSUER: "https://tenant.eu.auth0.com",
    VITE_OIDC_CLIENT_ID: "public-client",
    VITE_OIDC_AUDIENCE: "https://api.monpiole.example",
    VITE_OIDC_REDIRECT_URI: "http://localhost:5173/",
    VITE_OIDC_LOGOUT_RETURN_URI: "http://localhost:5173/connexion",
  };

  it("normalise une configuration OIDC complète", () => {
    expect(readPublicWebConfig(validEnvironment)).toEqual({
      apiBaseUrl: "https://api.example.com",
      oidc: {
        issuer: "https://tenant.eu.auth0.com/",
        domain: "tenant.eu.auth0.com",
        clientId: "public-client",
        audience: "https://api.monpiole.example",
        redirectUri: "http://localhost:5173",
        logoutReturnUri: "http://localhost:5173/connexion",
      },
    });
  });

  it("rejette une URL publique invalide", () => {
    expect(() => readPublicWebConfig({ ...validEnvironment, VITE_API_BASE_URL: "not-an-url" })).toThrow("VITE_API_BASE_URL");
  });

  it("rejette une configuration OIDC obligatoire manquante", () => {
    expect(() => readPublicWebConfig({ ...validEnvironment, VITE_OIDC_CLIENT_ID: " " })).toThrow("VITE_OIDC_CLIENT_ID est obligatoire");
  });

  it("exige un issuer OIDC HTTPS", () => {
    expect(() => readPublicWebConfig({ ...validEnvironment, VITE_OIDC_ISSUER: "http://tenant.auth0.com" })).toThrow("VITE_OIDC_ISSUER doit être une URL HTTPS");
  });
});
