import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { configureBrowserCors } from "../../apps/api/src/configuration/browser-cors.js";

describe("API browser CORS policy", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>>;
  let baseUrl: string;

  beforeAll(async () => {
    application = await createApiApplication({ logger: false });
    configureBrowserCors(application, { allowedOrigins: ["http://localhost:5173"] });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => application.close());

  it("grants CORS access to the configured browser origin", async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: "http://localhost:5173" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("does not grant CORS access to an unknown origin", async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: "https://unknown.example" } });
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("supports an Authorization and Content-Type preflight", async () => {
    const response = await fetch(`${baseUrl}/v1/properties`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("authorization");
    expect(response.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type");
  });
});
