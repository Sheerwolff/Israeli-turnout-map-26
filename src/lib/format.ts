// Consistent number formatting for the UI.

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-US"));

export const fmtPct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`);

/** Share in [0, 1] → "42.0%". */
export const fmtShare = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(digits)}%`);

/** Signed percentage points: "+3.2 pp", "−1.0 pp", "0.0 pp". */
export function fmtPp(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const r = Number(n.toFixed(digits));
  const s = Math.abs(r).toFixed(digits);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${s} pp`;
}

/** Signed balance: "+0.42", "−0.10". */
export function fmtBalance(n: number | null | undefined): string {
  if (n === null || n === undefined) return "unavailable";
  const r = Number(n.toFixed(2));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`;
}

export const POPULATION_GROUP_EN: Record<string, string> = {
  "יהודי": "Jewish",
  "לא יהודי": "Non-Jewish",
  "מעורב": "Mixed",
  "מקום": "Non-residential / special",
};

export const WARNING_TEXT: Record<string, string> = {
  no_geometry: "No boundary polygon — not drawn on the map.",
  missing_2022: "No 2022 results for this locality code.",
  missing_2026: "No 2026 data for this locality code.",
  invalid_turnout_2022: "2022 turnout unusable (missing denominator or outside 0–100%).",
  invalid_turnout_2026: "2026 turnout unusable (no boxes reported, or outside 0–100%).",
  partial_2026_coverage: "2026 data cover only part of the locality's registered electorate.",
  uses_preliminary_feed: "Some 2026 boxes are not yet counted; their figures come from the preliminary 22:00 turnout feed.",
  uses_stale_feed: "Some feed boxes were last updated well before polls closed and probably under-state turnout.",
  top_party_tie: "Two or more parties tied for the most votes in 2022 (tie rule applied).",
  no_bloc_votes: "No 2022 votes for either defined bloc — political balance unavailable.",
  unknown_party_letters: "Some 2022 party letters are missing from the party configuration.",
  name_differs_between_sources: "Name differs between 2022 and 2026 CEC files (joined by official code).",
  mock_2026: "2026 values are synthetic (mock mode).",
};

/** One-phrase versions for the hover tooltip. */
export const WARNING_SHORT: Record<string, string> = {
  no_geometry: "no boundary polygon",
  missing_2022: "no 2022 results",
  missing_2026: "no 2026 data",
  invalid_turnout_2022: "invalid 2022 turnout",
  invalid_turnout_2026: "invalid 2026 turnout",
  partial_2026_coverage: "2026 data incomplete",
  uses_preliminary_feed: "some 2026 boxes from preliminary feed",
  uses_stale_feed: "some feed boxes stale",
  top_party_tie: "top-party tie",
  no_bloc_votes: "no bloc votes",
  unknown_party_letters: "unclassified party letters",
  mock_2026: "MOCK 2026 data",
};
