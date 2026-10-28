// User filters. They narrow which localities are shown and summarised; they
// never change how any locality is classified or colored.

import type { LocalityRecord } from "./types";

export interface Filters {
  /** Inclusive balance range for blue–red localities. At [−1, 1] localities without a balance are kept too. */
  balanceRange: [number, number];
  /** Inclusive turnout-change range in pp; null bound = open. */
  changeMin: number | null;
  changeMax: number | null;
  includeGray: boolean;
  /** Minimum eligible voters in 2022. */
  minEligible: number;
  /** Minimum share of the 2026 roster electorate covered by the data (0–1). */
  minCoverage2026: number;
  /** CBS population-group values to keep; empty = all. */
  populationGroups: string[];
  /** Keep localities that use preliminary 22:00 feed figures for some boxes. */
  includePreliminaryFeed: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  balanceRange: [-1, 1],
  changeMin: null,
  changeMax: null,
  includeGray: true,
  minEligible: 0,
  minCoverage2026: 0,
  populationGroups: [],
  includePreliminaryFeed: true,
};

export function isDefaultFilters(f: Filters): boolean {
  return JSON.stringify(f) === JSON.stringify(DEFAULT_FILTERS);
}

/** Does a locality pass the filters? Only analysed localities can pass. */
export function passesFilters(r: LocalityRecord, f: Filters): boolean {
  if (!r.analysed) return false;
  const c = r.classification!;
  if (c.isArabPlurality) {
    if (!f.includeGray) return false;
  } else {
    const full = f.balanceRange[0] <= -1 && f.balanceRange[1] >= 1;
    if (c.balance === null) {
      if (!full) return false;
    } else if (c.balance < f.balanceRange[0] || c.balance > f.balanceRange[1]) return false;
  }
  const ch = r.turnoutChangePp!;
  if (f.changeMin !== null && ch < f.changeMin) return false;
  if (f.changeMax !== null && ch > f.changeMax) return false;
  if ((r.y2022?.eligible ?? 0) < f.minEligible) return false;
  if (f.minCoverage2026 > 0 && (r.y2026?.coverage ?? 1) < f.minCoverage2026) return false;
  if (f.populationGroups.length && !f.populationGroups.includes(r.populationGroup ?? "")) return false;
  if (!f.includePreliminaryFeed && r.warnings.includes("uses_preliminary_feed")) return false;
  return true;
}
