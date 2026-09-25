import { describe, expect, it } from "vitest";

import {
  SystemFirstAdministratorBootstrapClock,
} from "../src/index.js";

describe("SystemFirstAdministratorBootstrapClock", () => {
  it("returns a valid ISO-8601 UTC timestamp", () => {
    const clock = new SystemFirstAdministratorBootstrapClock();

    const now = clock.now();

    expect(Number.isNaN(Date.parse(now))).toBe(false);
    expect(new Date(now).toISOString()).toBe(now);
    expect(now.endsWith("Z")).toBe(true);
  });
});