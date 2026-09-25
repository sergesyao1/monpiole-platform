import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiSessionExpiredError } from "../../infrastructure/http/api-client.js";
import {
  createPlatformAgencyRegistrationAuthorizationApi,
} from "./platform-agency-registration-authorization-api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("platform agency registration authorization API", () => {
  it("returns true when the backend probe returns 204", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const getAccessToken = vi.fn(async () => "platform-token");

    const api = createPlatformAgencyRegistrationAuthorizationApi({
      getAccessToken,
    });

    await expect(api.canRetrieveRegistrations()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3000/v1/authentication/authorization/platform-agency-registration-read",
    );

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer platform-token");
  });

  it("returns false when the backend probe returns 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 403 }),
    );
    const getAccessToken = vi.fn(async () => "tenant-token");

    const api = createPlatformAgencyRegistrationAuthorizationApi({
      getAccessToken,
    });

    await expect(api.canRetrieveRegistrations()).resolves.toBe(false);

    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it("preserves session expiration semantics after the single 401 refresh", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    const getAccessToken = vi.fn(
      async (fresh?: boolean) =>
        fresh ? "fresh-platform-token" : "cached-platform-token",
    );

    const api = createPlatformAgencyRegistrationAuthorizationApi({
      getAccessToken,
    });

    await expect(
      api.canRetrieveRegistrations(),
    ).rejects.toBeInstanceOf(ApiSessionExpiredError);

    expect(getAccessToken.mock.calls).toEqual([[], [true]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});