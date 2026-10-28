// Turnout in the CEC sense: voters (envelopes cast in the box, valid + invalid)
// divided by eligible voters registered to the box, in percent. Pure functions.

export type TurnoutIssue = "no_eligible" | "negative" | "above_100";

export interface TurnoutResult {
  pct: number | null;
  issue: TurnoutIssue | null;
}

export function turnoutPct(voters: number, eligible: number): TurnoutResult {
  if (!(eligible > 0)) return { pct: null, issue: "no_eligible" };
  if (voters < 0) return { pct: null, issue: "negative" };
  const pct = (voters / eligible) * 100;
  if (pct > 100) return { pct: null, issue: "above_100" };
  return { pct, issue: null };
}

/** True for a turnout percentage that can be used in the analysis. */
export function isValidTurnoutPct(pct: number | null | undefined): pct is number {
  return typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100;
}

/**
 * Change in turnout in percentage points (not a relative % change):
 * turnout_2026_pct − turnout_2022_pct. Null if either side is unusable.
 */
export function turnoutChangePp(turnout2022Pct: number | null, turnout2026Pct: number | null): number | null {
  if (!isValidTurnoutPct(turnout2022Pct) || !isValidTurnoutPct(turnout2026Pct)) return null;
  // Round away binary floating-point noise (e.g. 70.1 − 60.1) without changing any reported digit.
  return Math.round((turnout2026Pct - turnout2022Pct) * 1e9) / 1e9;
}
