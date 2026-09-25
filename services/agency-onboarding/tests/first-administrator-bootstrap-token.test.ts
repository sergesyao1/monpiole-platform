import { describe, expect, it } from "vitest";

import {
  SecureFirstAdministratorBootstrapTokenGenerator,
  Sha256FirstAdministratorBootstrapTokenHasher,
} from "../src/index.js";

describe("first administrator bootstrap token security", () => {
  it("generates opaque URL-safe tokens with 256 bits of entropy", () => {
    const generator =
      new SecureFirstAdministratorBootstrapTokenGenerator();

    const first = generator.generate();
    const second = generator.generate();

    expect(first).not.toBe(second);

    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]+$/);

    // 32 bytes encoded as unpadded base64url => 43 characters.
    expect(first).toHaveLength(43);
    expect(second).toHaveLength(43);
  });

  it("hashes tokens deterministically as lowercase SHA-256 hex", () => {
    const hasher =
      new Sha256FirstAdministratorBootstrapTokenHasher();

    const token = "bootstrap-token-example";

    const first = hasher.hash(token);
    const second = hasher.hash(token);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different tokens", () => {
    const hasher =
      new Sha256FirstAdministratorBootstrapTokenHasher();

    expect(hasher.hash("token-a"))
      .not.toBe(hasher.hash("token-b"));
  });

  it("never exposes the raw token through its persisted representation", () => {
    const generator =
      new SecureFirstAdministratorBootstrapTokenGenerator();

    const hasher =
      new Sha256FirstAdministratorBootstrapTokenHasher();

    const token = generator.generate();
    const hash = hasher.hash(token);

    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});