import { describe, expect, it } from "vitest";
import { applyRateBps, formatMoney, fromMinor, minorToDecimalString, toMinor } from "./money";
import { createRng, deriveSeed, hashString } from "./rng";

describe("rng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it("derives stable, order-sensitive seeds", () => {
    expect(deriveSeed(42, "customers", 7)).toBe(deriveSeed(42, "customers", 7));
    expect(deriveSeed(42, "customers", 7)).not.toBe(deriveSeed(42, "customers", 8));
    expect(deriveSeed(42, "orders", 7)).not.toBe(deriveSeed(42, "customers", 7));
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  it("keeps int() within inclusive bounds", () => {
    const rng = createRng(9);
    for (let i = 0; i < 2000; i++) {
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it("samples distinct items", () => {
    const picked = createRng(5).sample([1, 2, 3, 4, 5, 6], 4);
    expect(new Set(picked).size).toBe(4);
  });
});

describe("money", () => {
  it("round-trips minor units", () => {
    expect(toMinor(482.1, "USD")).toBe(48210);
    expect(fromMinor(48210, "USD")).toBe(482.1);
    expect(minorToDecimalString(48210, "USD")).toBe("482.10");
    expect(minorToDecimalString(-5, "GBP")).toBe("-0.05");
  });

  it("applies basis-point rates with half-up rounding", () => {
    expect(applyRateBps(10000, 725)).toBe(725); // $100.00 × 7.25%
    expect(applyRateBps(1999, 2000)).toBe(400); // 399.8 → 400
    expect(applyRateBps(25, 2000)).toBe(5); // exactly 5
    expect(applyRateBps(1, 5000)).toBe(1); // 0.5 → 1
  });

  it("formats with the locale and currency", () => {
    expect(formatMoney(124000, "USD", "en-US")).toBe("$1,240.00");
    expect(formatMoney(124000, "GBP", "en-GB")).toBe("£1,240.00");
  });
});
