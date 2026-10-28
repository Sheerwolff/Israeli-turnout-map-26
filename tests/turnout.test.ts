import { describe, expect, it } from "vitest";
import { turnoutChangePp, turnoutPct } from "../src/lib/turnout";

describe("turnout change in percentage points", () => {
  it("case 8: 60% → 70% is +10 pp", () => expect(turnoutChangePp(60, 70)).toBe(10));
  it("case 9: 70% → 60% is −10 pp", () => expect(turnoutChangePp(70, 60)).toBe(-10));
  it("case 10: 65% → 65% is 0 pp", () => expect(turnoutChangePp(65, 65)).toBe(0));
  it("is a difference, not a relative change (40% → 45% is +5 pp, not +12.5%)", () => {
    expect(turnoutChangePp(40, 45)).toBe(5);
    expect(turnoutChangePp(80, 75)).toBe(-5);
  });
  it("removes floating-point noise", () => expect(turnoutChangePp(60.1, 70.1)).toBe(10));
  it("is unavailable when either turnout is missing or invalid", () => {
    expect(turnoutChangePp(null, 70)).toBeNull();
    expect(turnoutChangePp(60, null)).toBeNull();
    expect(turnoutChangePp(60, 120)).toBeNull();
    expect(turnoutChangePp(-1, 50)).toBeNull();
  });
});

describe("turnout rate", () => {
  it("is voters / eligible × 100", () => expect(turnoutPct(450, 600).pct).toBe(75));
  it("refuses a zero denominator rather than inventing a value", () => expect(turnoutPct(10, 0)).toEqual({ pct: null, issue: "no_eligible" }));
  it("flags rates above 100%", () => expect(turnoutPct(700, 600)).toEqual({ pct: null, issue: "above_100" }));
});
