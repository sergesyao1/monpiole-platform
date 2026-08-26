import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    env: {
      VITE_OIDC_ISSUER: "https://tests.eu.auth0.com/",
      VITE_OIDC_CLIENT_ID: "test-public-client",
      VITE_OIDC_AUDIENCE: "https://api.tests.monpiole.example",
      VITE_OIDC_REDIRECT_URI: "http://localhost:5173",
      VITE_OIDC_LOGOUT_RETURN_URI: "http://localhost:5173/connexion",
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
