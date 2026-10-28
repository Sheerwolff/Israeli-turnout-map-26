// Central, documented configuration for every analytical choice that is not
// fixed by the data. Changing a value here changes the map, legend, dashboard
// and tests consistently; nothing in the UI hardcodes these numbers.

export type LightnessDirection = "darker_means_increase" | "lighter_means_increase";

export interface ColorScaleConfig {
  /** Symmetric bound of the turnout-change scale, in percentage points. |Δ| beyond it is clipped (and flagged). */
  maxAbsChangePp: number;
  /** Which way lightness moves when turnout rises. */
  direction: LightnessDirection;
  /** OKLCH lightness (0–1) used for a change of exactly 0 pp. */
  neutralLightness: number;
  /** How far lightness moves at ±maxAbsChangePp. */
  lightnessSpan: number;
  /** Target OKLCH chroma for blue–red hues (reduced only where sRGB cannot show it). */
  chroma: number;
  /** OKLCH hue at political_balance = −1 (anti-Netanyahu). */
  hueAnti: number;
  /** OKLCH hue at political_balance = +1 (pro-Netanyahu). Interpolated through purple, never through gray. */
  huePro: number;
}

export interface TendencyCutoffs {
  /** balance ≤ antiMax → "anti-Netanyahu-leaning" summary group. */
  antiMax: number;
  /** balance ≥ proMin → "pro-Netanyahu-leaning" summary group. Values in between are "balanced". */
  proMin: number;
}

export interface AnalysisConfig {
  color: ColorScaleConfig;
  /** Summary groups for the dashboard only. The map always uses the continuous scale. */
  tendency: TendencyCutoffs;
  /** |Δ| below this many pp counts as "approximately unchanged" in the dashboard. */
  unchangedThresholdPp: number;
  /** Scale bounds offered in the legend's selector (pp). */
  scaleBoundChoices: number[];
}

export const ANALYSIS_CONFIG: AnalysisConfig = {
  color: {
    // Chosen after inspecting the observed distribution (docs/METHODOLOGY.md,
    // "Scale bounds"): ±12 pp spans the 5th–95th percentile of non-gray
    // localities (−1.4 to +10.7 pp), so the very large increases in many
    // Arab-plurality localities (median +28 pp) are clipped — and flagged —
    // instead of flattening every other difference. Adjustable in the legend.
    maxAbsChangePp: 12,
    direction: "darker_means_increase",
    neutralLightness: 0.67,
    lightnessSpan: 0.23,
    chroma: 0.14,
    hueAnti: 255,
    huePro: 27,
  },
  tendency: { antiMax: -0.2, proMin: 0.2 },
  unchangedThresholdPp: 0.5,
  scaleBoundChoices: [6, 8, 12, 20, 30, 45],
};
