import { beforeEach, describe, expect, it } from "vitest";

import { Auth0SessionStorageCache } from "./Auth0SessionStorageCache.js";

describe("cache de session Auth0", () => {
  beforeEach(() => sessionStorage.clear());

  it("restaure une entrée SDK après reconstruction du cache dans le même onglet", () => {
    new Auth0SessionStorageCache().set("sdk-key", { body: { refresh_token: "opaque-test-value" }, expiresAt: 42 });
    expect(new Auth0SessionStorageCache().get("sdk-key")).toEqual({
      body: { refresh_token: "opaque-test-value" }, expiresAt: 42,
    });
  });

  it("isole les clés SDK et ne supprime pas les autres données de session", () => {
    sessionStorage.setItem("application-key", "preserved");
    const cache = new Auth0SessionStorageCache();
    cache.set("first", { value: 1 });
    cache.set("second", { value: 2 });
    expect(cache.allKeys().sort()).toEqual(["first", "second"]);
    cache.remove("first");
    expect(cache.get("first")).toBeUndefined();
    expect(sessionStorage.getItem("application-key")).toBe("preserved");
  });

  it("échoue fermé et supprime une entrée corrompue", () => {
    sessionStorage.setItem("monpiole:auth0-cache:corrupted", "not-json");
    const cache = new Auth0SessionStorageCache();
    expect(cache.get("corrupted")).toBeUndefined();
    expect(cache.allKeys()).toEqual([]);
  });
});
