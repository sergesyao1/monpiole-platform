import { describe, expect, it } from "vitest";

import { dateInputToUtcInstant, formatStayInterval, utcInstantToDateInput } from "./public-catalog-date.js";

describe("public catalog date boundary", () => {
  it("maps calendar dates to deterministic UTC midnight instants", () => {
    expect(dateInputToUtcInstant("2026-12-10")).toBe("2026-12-10T00:00:00.000Z");
    expect(dateInputToUtcInstant("2026-12-15")).toBe("2026-12-15T00:00:00.000Z");
  });

  it("restores the UTC calendar date without a browser-timezone shift", () => {
    expect(utcInstantToDateInput("2026-12-10T00:00:00.000Z")).toBe("2026-12-10");
    expect(utcInstantToDateInput("2026-12-10T23:30:00.000Z")).toBe("2026-12-10");
  });

  it.each(["", "10/12/2026", "2026-02-30", "2026-13-01"])("rejects malformed date %s", (value) => {
    expect(dateInputToUtcInstant(value)).toBeUndefined();
  });

  it("formats the half-open stay boundaries as public dates", () => {
    expect(formatStayInterval("2026-12-10T00:00:00.000Z", "2026-12-15T00:00:00.000Z")).toMatch(/10.*15.*2026/u);
  });
});
