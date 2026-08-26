import { describe, expect, it } from "vitest";

import { readPublicWebConfig } from "./public-config.js";

describe("configuration publique web", () => {
  it("normalise l'URL API et ignore les paramètres OIDC vides", () => {
    expect(readPublicWebConfig({ VITE_API_BASE_URL: "https://api.example.com/", VITE_OIDC_ISSUER: " " }))
      .toEqual({ apiBaseUrl: "https://api.example.com", oidc: {} });
  });

  it("rejette une URL publique invalide", () => {
    expect(() => readPublicWebConfig({ VITE_API_BASE_URL: "not-an-url" }))
      .toThrow("VITE_API_BASE_URL");
  });
});
