// Central, documented configuration for every analytical choice that is not
// fixed by the data. Changing a value here changes the map, legend, dashboard
// and tests consistently; nothing in the UI hardcodes these numbers.

export type LightnessDirection = "darker_means_increase" | "lighter_means_increase";

/**
 * "categorical": four hues — blue (anti-leaning), purple (balanced), red (pro-leaning), gray (Arab plurality),
 * with the category cut-offs below. "continuous": hue slides from blue through purple to red with the balance.
 */
export type HueMode = "categorical" | "continuous";

export interface TendencyCutoffs {
  /** balance ≤ antiMax → anti-Netanyahu-leaning (blue). */
  antiMax: number;
  /** balance ≥ proMin → pro-Netanyahu-leaning (red). Values in between are balanced (purple). */
  proMin: number;
}

export interface ColorScaleConfig {
  hueMode: HueMode;
  /** Category cut-offs used for categorical hues (the same object the dashboard groups use). */
  categories: TendencyCutoffs;
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
  /** OKLCH hue at political_balance = +1 (pro-Netanyahu). Continuous mode interpolates through purple, never through gray. */
  huePro: number;
  /** OKLCH hue of the "balanced" category in categorical mode. */
  hueBalanced: number;
}

export interface AnalysisConfig {
  color: ColorScaleConfig;
  /** Political-tendency groups: the map's categorical hues and the dashboard summaries. */
  tendency: TendencyCutoffs;
  /** |Δ| below this many pp counts as "approximately unchanged" in the dashboard. */
  unchangedThresholdPp: number;
  /** Scale bounds offered in the legend's selector (pp). */
  scaleBoundChoices: number[];
}

const TENDENCY: TendencyCutoffs = { antiMax: -0.2, proMin: 0.2 };

export const ANALYSIS_CONFIG: AnalysisConfig = {
  color: {
    hueMode: "categorical",
    categories: TENDENCY,
    // Chosen after inspecting the observed distribution (docs/METHODOLOGY.md,
    // "Scale bounds"): ±12 pp spans the 5th–95th percentile of non-gray
    // localities (−2.0 to +12.2 pp), so the very large increases in many
    // Arab-plurality localities (median +26.6 pp) are clipped — and flagged —
    // instead of flattening every other difference. Adjustable in the legend.
    maxAbsChangePp: 12,
    direction: "darker_means_increase",
    neutralLightness: 0.67,
    lightnessSpan: 0.23,
    chroma: 0.14,
    hueAnti: 255,
    huePro: 27,
    hueBalanced: 321,
  },
  tendency: TENDENCY,
  unchangedThresholdPp: 0.5,
  scaleBoundChoices: [6, 8, 12, 20, 30, 45],
};
