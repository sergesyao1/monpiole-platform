import { describe, expect, it } from "vitest";

describe("CI required negative proof", () => {
  it("fails intentionally to prove required CI blocks merge", () => {
    expect(true).toBe(false);
  });
});
