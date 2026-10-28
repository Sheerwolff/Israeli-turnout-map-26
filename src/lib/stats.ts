// Small, dependency-free descriptive statistics and the analytical summaries
// shown on the dashboard.

import type { AnalysisConfig, TendencyCutoffs } from "../config/analysis";
import type { LocalityRecord } from "./types";

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Linear-interpolation quantile (same as numpy's default), on unsorted input. */
export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const median = (xs: number[]) => quantile(xs, 0.5);

export interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
}

/** Tukey box-plot statistics (whiskers at the most extreme points within 1.5 × IQR). */
export function boxStats(xs: number[]): BoxStats | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25)!;
  const q3 = quantile(s, 0.75)!;
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const inside = s.filter((x) => x >= lo && x <= hi);
  return {
    n: s.length,
    min: s[0],
    q1,
    median: quantile(s, 0.5)!,
    q3,
    max: s[s.length - 1],
    whiskerLow: inside[0],
    whiskerHigh: inside[inside.length - 1],
    outliers: s.filter((x) => x < lo || x > hi),
  };
}

export type TendencyGroup = "anti" | "balanced" | "pro" | "gray" | "unavailable";

export const TENDENCY_LABELS: Record<TendencyGroup, string> = {
  anti: "Anti-Netanyahu-leaning",
  balanced: "Politically balanced",
  pro: "Pro-Netanyahu-leaning",
  gray: "Arab-party plurality (gray)",
  unavailable: "Balance unavailable",
};

export const TENDENCY_SHORT: Record<TendencyGroup, string> = {
  anti: "Anti-leaning",
  balanced: "Balanced",
  pro: "Pro-leaning",
  gray: "Arab plurality",
  unavailable: "Unavailable",
};

export function tendencyGroup(rec: LocalityRecord, cut: TendencyCutoffs): TendencyGroup {
  const c = rec.classification;
  if (!c) return "unavailable";
  if (c.isArabPlurality) return "gray";
  if (c.balance === null) return "unavailable";
  if (c.balance <= cut.antiMax) return "anti";
  if (c.balance >= cut.proMin) return "pro";
  return "balanced";
}

export interface OverallSummary {
  analysed: number;
  meanChangePp: number | null;
  medianChangePp: number | null;
  increased: number;
  decreased: number;
  unchanged: number;
  /** Aggregate turnout of the selected localities: Σvoters / Σeligible, each year. */
  aggregate2022Pct: number | null;
  aggregate2026Pct: number | null;
  /** aggregate2026Pct − aggregate2022Pct (voter-weighted, not a national figure). */
  aggregateChangePp: number | null;
}

/** Summary over analysed localities (callers pass records already filtered). */
export function overallSummary(recs: LocalityRecord[], cfg: AnalysisConfig): OverallSummary {
  const rows = recs.filter((r) => r.analysed && r.turnoutChangePp !== null);
  const ch = rows.map((r) => r.turnoutChangePp!);
  const t = cfg.unchangedThresholdPp;
  let e22 = 0, v22 = 0, e26 = 0, v26 = 0;
  for (const r of rows) {
    e22 += r.y2022!.eligible;
    v22 += r.y2022!.voters;
    e26 += r.y2026!.eligible;
    v26 += r.y2026!.voters;
  }
  const a22 = e22 > 0 ? (v22 / e22) * 100 : null;
  const a26 = e26 > 0 ? (v26 / e26) * 100 : null;
  return {
    analysed: rows.length,
    meanChangePp: mean(ch),
    medianChangePp: median(ch),
    increased: ch.filter((x) => x >= t).length,
    decreased: ch.filter((x) => x <= -t).length,
    unchanged: ch.filter((x) => Math.abs(x) < t).length,
    aggregate2022Pct: a22,
    aggregate2026Pct: a26,
    aggregateChangePp: a22 !== null && a26 !== null ? a26 - a22 : null,
  };
}

export interface GroupSummary {
  group: TendencyGroup;
  n: number;
  meanChangePp: number | null;
  medianChangePp: number | null;
  box: BoxStats | null;
}

export function groupSummaries(recs: LocalityRecord[], cfg: AnalysisConfig): GroupSummary[] {
  const groups: TendencyGroup[] = ["anti", "balanced", "pro", "gray"];
  return groups.map((g) => {
    const ch = recs
      .filter((r) => r.analysed && r.turnoutChangePp !== null && tendencyGroup(r, cfg.tendency) === g)
      .map((r) => r.turnoutChangePp!);
    return { group: g, n: ch.length, meanChangePp: mean(ch), medianChangePp: median(ch), box: boxStats(ch) };
  });
}
