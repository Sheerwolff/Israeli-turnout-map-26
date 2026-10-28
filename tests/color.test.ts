import { describe, expect, it } from "vitest";
import { ANALYSIS_CONFIG, type ColorScaleConfig } from "../src/config/analysis";
import { balanceToHue, changeToLightness, hexToOklabLightness, localityColor } from "../src/lib/color";

const cfg = ANALYSIS_CONFIG.color;

/** Rough hue family of an sRGB hex: compares channels. */
function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

describe("hue from political balance", () => {
  it("strong pro-Netanyahu balance is red", () => {
    const c = localityColor({ balance: 0.9, changePp: 0, isArabPlurality: false }, cfg);
    const [r, g, b] = rgb(c.hex!);
    expect(c.kind).toBe("bloc");
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(g);
  });

  it("strong anti-Netanyahu balance is blue", () => {
    const c = localityColor({ balance: -0.9, changePp: 0, isArabPlurality: false }, cfg);
    const [r, g, b] = rgb(c.hex!);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("balance 0 is a neutral intermediate (purple) hue, distinct from gray", () => {
    const hue = balanceToHue(0, cfg);
    const mid = (cfg.hueAnti + (cfg.huePro + 360)) / 2;
    expect(hue).toBeCloseTo(mid % 360);
    const [r, g, b] = rgb(localityColor({ balance: 0, changePp: 0, isArabPlurality: false }, cfg).hex!);
    expect(r).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(g); // purple: red and blue both above green
  });

  it("is continuous: small balance changes give small hue changes", () => {
    const step = Math.abs(balanceToHue(0.31, cfg) - balanceToHue(0.3, cfg));
    expect(step).toBeLessThan(1);
  });

  it("does not depend on turnout change", () => {
    const a = localityColor({ balance: 0.4, changePp: -7, isArabPlurality: false }, cfg);
    const b = localityColor({ balance: 0.4, changePp: 7, isArabPlurality: false }, cfg);
    expect(a.hue).toBe(b.hue);
  });
});

describe("lightness from turnout change", () => {
  it("default: an increase is darker, a decrease is lighter, 0 is neutral", () => {
    const up = changeToLightness(5, cfg).lightness;
    const flat = changeToLightness(0, cfg).lightness;
    const down = changeToLightness(-5, cfg).lightness;
    expect(flat).toBe(cfg.neutralLightness);
    expect(up).toBeLessThan(flat);
    expect(down).toBeGreaterThan(flat);
  });

  it("is symmetric around zero", () => {
    const up = changeToLightness(4, cfg).lightness - cfg.neutralLightness;
    const down = changeToLightness(-4, cfg).lightness - cfg.neutralLightness;
    expect(up).toBeCloseTo(-down);
  });

  it("the same change gives the same lightness for gray, blue, red and purple localities", () => {
    for (const change of [-9, -3, 0, 2.5, 8]) {
      const colors = [
        localityColor({ balance: null, changePp: change, isArabPlurality: true }, cfg),
        localityColor({ balance: -0.8, changePp: change, isArabPlurality: false }, cfg),
        localityColor({ balance: 0.8, changePp: change, isArabPlurality: false }, cfg),
        localityColor({ balance: 0, changePp: change, isArabPlurality: false }, cfg),
      ];
      const L = colors.map((c) => c.lightness);
      expect(new Set(L).size).toBe(1);
      // And the rendered sRGB colors really have that perceptual lightness (gamut mapping only lowers chroma).
      for (const c of colors) expect(hexToOklabLightness(c.hex!)).toBeCloseTo(c.lightness!, 2);
    }
  });

  it("depends on the change, not the level: 80→75 and 40→35 look the same", () => {
    const a = localityColor({ balance: 0.2, changePp: 75 - 80, isArabPlurality: false }, cfg);
    const b = localityColor({ balance: 0.2, changePp: 35 - 40, isArabPlurality: false }, cfg);
    expect(a.hex).toBe(b.hex);
  });

  it("clips beyond the configured bound and says so", () => {
    const at = localityColor({ balance: 0.5, changePp: cfg.maxAbsChangePp, isArabPlurality: false }, cfg);
    const beyond = localityColor({ balance: 0.5, changePp: cfg.maxAbsChangePp + 20, isArabPlurality: false }, cfg);
    expect(at.clipped).toBe(false);
    expect(beyond.clipped).toBe(true);
    expect(beyond.hex).toBe(at.hex);
  });

  it("direction is configurable centrally", () => {
    const flipped: ColorScaleConfig = { ...cfg, direction: "lighter_means_increase" };
    expect(changeToLightness(5, flipped).lightness).toBeGreaterThan(flipped.neutralLightness);
  });
});

describe("special cases", () => {
  it("gray localities have zero chroma", () => {
    const [r, g, b] = rgb(localityColor({ balance: 0.9, changePp: 3, isArabPlurality: true }, cfg).hex!);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1);
  });
  it("unavailable balance → no color is invented", () => {
    const c = localityColor({ balance: null, changePp: 3, isArabPlurality: false }, cfg);
    expect(c.hex).toBeNull();
    expect(c.kind).toBe("no_balance");
  });
  it("missing turnout change → no color", () => {
    expect(localityColor({ balance: 0.3, changePp: null, isArabPlurality: false }, cfg).kind).toBe("no_turnout");
  });
  it("is deterministic", () => {
    const i = { balance: 0.123, changePp: -2.2, isArabPlurality: false };
    expect(localityColor(i, cfg)).toEqual(localityColor(i, cfg));
  });
});
