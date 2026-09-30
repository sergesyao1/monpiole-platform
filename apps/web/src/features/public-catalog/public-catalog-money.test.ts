import { describe, expect, it } from "vitest";

import { formatCatalogMoney, majorAmountToMinor, minorAmountToMajorInput } from "./public-catalog-money.js";

const xof = { code: "XOF", nameKey: "currency.xof", minorUnit: 0, active: true } as const;
const usd = { code: "USD", nameKey: "currency.usd", minorUnit: 2, active: true } as const;
const bhd = { code: "BHD", nameKey: "currency.bhd", minorUnit: 3, active: true } as const;

describe("public catalog money conversion", () => {
  it("uses the reference exponent instead of a universal two-decimal assumption", () => {
    expect(majorAmountToMinor("150000", xof)).toBe(150_000);
    expect(majorAmountToMinor("10.50", usd)).toBe(1_050);
    expect(majorAmountToMinor("10,125", bhd)).toBe(10_125);
  });

  it("preserves zero and round trips minor amounts exactly", () => {
    expect(majorAmountToMinor("0", xof)).toBe(0);
    expect(minorAmountToMajorInput(0, usd)).toBe("0.00");
    expect(minorAmountToMajorInput(1_050, usd)).toBe("10.50");
    expect(formatCatalogMoney(1_050, usd)).toBe("10,50 USD");
  });

  it.each(["-1", "1.234", "1e3", "NaN", "1 000", "9007199254740992"])("rejects malformed or unsafe value %s", (value) => {
    expect(majorAmountToMinor(value, usd)).toBeUndefined();
  });
});
