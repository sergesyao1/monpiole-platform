import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";

describe("NestJS API composition root", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;

  afterEach(async () => {
    await application?.close();
  });

  it("bootstraps and exposes GET /health", async () => {
    application = await createApiApplication({ logger: false });
    await application.listen(0, "127.0.0.1");

    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") {
      throw new Error("NestJS did not bind an ephemeral TCP port");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
