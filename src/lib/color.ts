// Two-dimensional color encoding:
//   hue       ← 2022 political balance (blue = anti, red = pro, purple between;
//               gray for an Arab-party plurality)
//   lightness ← 2022→2026 turnout change in pp (same scale for every hue)
// Built in OKLCH so equal lightness values look equally light across hues.

import type { ColorScaleConfig } from "../config/analysis";

export type ColorKind = "bloc" | "gray" | "no_balance" | "no_turnout";

export interface ColorInput {
  balance: number | null;
  changePp: number | null;
  isArabPlurality: boolean;
}

export interface ColorResult {
  /** sRGB hex, or null when the locality cannot be colored (see kind). */
  hex: string | null;
  kind: ColorKind;
  /** OKLCH hue used (null for gray / uncolored). */
  hue: number | null;
  /** OKLCH lightness used (null when uncolored). */
  lightness: number | null;
  /** True when |changePp| exceeds the scale bound and the lightness was clipped. */
  clipped: boolean;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Hue for a balance in [−1, 1]; interpolates hueAnti → huePro through purple (increasing hue angle). */
export function balanceToHue(balance: number, cfg: ColorScaleConfig): number {
  const t = (clamp(balance, -1, 1) + 1) / 2;
  let to = cfg.huePro;
  while (to <= cfg.hueAnti) to += 360;
  return (cfg.hueAnti + t * (to - cfg.hueAnti)) % 360;
}

/** Lightness for a turnout change; symmetric around 0, identical for every hue. */
export function changeToLightness(changePp: number, cfg: ColorScaleConfig): { lightness: number; clipped: boolean } {
  const clipped = Math.abs(changePp) > cfg.maxAbsChangePp;
  const s = clamp(changePp / cfg.maxAbsChangePp, -1, 1);
  const sign = cfg.direction === "darker_means_increase" ? -1 : 1;
  return { lightness: cfg.neutralLightness + sign * s * cfg.lightnessSpan, clipped };
}

/** The deterministic color function: color = f(political_balance, turnout_change_pp, is_arab_party_plurality). */
export function localityColor(input: ColorInput, cfg: ColorScaleConfig): ColorResult {
  if (input.changePp === null || !Number.isFinite(input.changePp)) {
    return { hex: null, kind: "no_turnout", hue: null, lightness: null, clipped: false };
  }
  const { lightness, clipped } = changeToLightness(input.changePp, cfg);
  if (input.isArabPlurality) {
    return { hex: oklchToHex(lightness, 0, 0), kind: "gray", hue: null, lightness, clipped };
  }
  if (input.balance === null || !Number.isFinite(input.balance)) {
    return { hex: null, kind: "no_balance", hue: null, lightness, clipped };
  }
  const hue = balanceToHue(input.balance, cfg);
  return { hex: oklchToHex(lightness, cfg.chroma, hue), kind: "bloc", hue, lightness, clipped };
}

// ---------------------------------------------------------------------------
// OKLCH → sRGB (Björn Ottosson's OKLab), with chroma reduction for out-of-gamut
// colors so lightness — the turnout signal — is never altered by gamut mapping.

type RGB = [number, number, number];

function oklabToLinearSrgb(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

function inGamut([r, g, b]: RGB): boolean {
  const e = 1e-6;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}

function oklchToLinear(L: number, C: number, H: number): RGB {
  const h = (H * Math.PI) / 180;
  return oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
}

/** Converts OKLCH to an sRGB hex string, lowering chroma (never lightness or hue) until the color fits sRGB. */
export function oklchToHex(L: number, C: number, H: number): string {
  let rgb = oklchToLinear(L, C, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(L, lo, H);
  }
  const to255 = (x: number) => Math.round(clamp(linearToSrgb(clamp(x, 0, 1)), 0, 1) * 255);
  return "#" + rgb.map((x) => to255(x).toString(16).padStart(2, "0")).join("");
}

/** Inverse helper used by tests: sRGB hex → OKLab lightness. */
export function hexToOklabLightness(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = v.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363377524 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}
