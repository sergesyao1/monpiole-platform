import { describe, expect, it } from "vitest";

import {
  InvalidBrowserCorsConfigurationError, browserCorsConfigurationFromEnvironment,
} from "../../apps/api/src/configuration/browser-cors.js";

describe("browser CORS configuration", () => {
  it("normalizes and deduplicates explicit origins", () => {
    expect(browserCorsConfigurationFromEnvironment({
      API_ALLOWED_BROWSER_ORIGINS: "http://localhost:5173/, https://web.example.test,http://localhost:5173",
    })).toEqual({ allowedOrigins: ["http://localhost:5173", "https://web.example.test"] });
  });

  it.each([undefined, "", "*", "https://web.example.test/path", "file:///tmp/web"])(
    "rejects missing, wildcard or non-origin configuration %s", (value) => {
      expect(() => browserCorsConfigurationFromEnvironment({ API_ALLOWED_BROWSER_ORIGINS: value }))
        .toThrow(InvalidBrowserCorsConfigurationError);
    },
  );
});
