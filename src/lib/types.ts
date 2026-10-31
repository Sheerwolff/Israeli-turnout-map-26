// Shared data types for the pipeline (scripts/) and the app (src/).

export type PartyGroup = "pro_netanyahu" | "anti_netanyahu" | "arab_parties" | "other_or_unclassified";

export const PARTY_GROUPS: PartyGroup[] = ["pro_netanyahu", "anti_netanyahu", "arab_parties", "other_or_unclassified"];

export interface PartyDef {
  letter: string;
  name_he: string;
  name_en: string;
  group: PartyGroup;
  note?: string;
  /** Filled in by the pipeline from the results file. */
  national_votes?: number;
}

export type BlocVotes = Record<PartyGroup, number>;

export type ClassificationCategory = "arab_plurality" | "bloc_balance" | "unavailable";

export interface Classification {
  category: ClassificationCategory;
  /** Letters of the party (or parties, on a tie) with the most valid votes. Empty when there are no votes. */
  topParties: string[];
  topPartyVotes: number;
  /** Top party's votes / valid votes. */
  topPartyShare: number | null;
  isTopTie: boolean;
  /** True only when one Arab party alone — or a tie made up only of Arab parties — has the most votes. */
  isArabPlurality: boolean;
  blocVotes: BlocVotes;
  validVotes: number;
  /** Bloc votes / valid votes. */
  proShare: number | null;
  antiShare: number | null;
  arabShare: number | null;
  otherShare: number | null;
  /** (pro − anti) / (pro + anti); null when pro + anti = 0 or the classification is insufficient. */
  balance: number | null;
  /** Letters with votes that are missing from the party config (counted as other_or_unclassified and flagged). */
  unknownLetters: string[];
  flags: ClassificationFlag[];
}

export type ClassificationFlag =
  | "top_party_tie"
  | "top_party_tie_arab_and_non_arab"
  | "no_valid_votes"
  | "no_bloc_votes"
  | "unknown_party_letters"
  | "unknown_votes_above_limit";

export type BoxSource2026 = "count" | "feed" | "feed_stale";

export interface Year2022 {
  name: string;
  eligible: number;
  voters: number;
  invalid: number;
  valid: number;
  turnoutPct: number | null;
  votes: Record<string, number>;
}

export interface Year2026 {
  name: string;
  /** Eligible voters in the boxes that have data. */
  eligible: number;
  voters: number;
  turnoutPct: number | null;
  /** Eligible voters on the CEC roster for this locality (all boxes), when the roster is available. */
  rosterEligible: number | null;
  /** eligible / rosterEligible. */
  coverage: number | null;
  boxesRoster: number | null;
  boxesCount: number;
  boxesFeed: number;
  boxesFeedStale: number;
  boxesMissing: number;
  /** Share of covered eligible voters whose figure comes from the 22:00 feed rather than the count. */
  feedShare: number;
  /** Share of covered eligible voters in feed boxes last updated before the stale cutoff. */
  staleFeedShare: number;
}

export type LocalityWarning =
  | "no_geometry"
  | "missing_2022"
  | "missing_2026"
  | "invalid_turnout_2022"
  | "invalid_turnout_2026"
  | "partial_2026_coverage"
  | "uses_preliminary_feed"
  | "uses_count_fallback"
  | "uses_stale_feed"
  | "top_party_tie"
  | "no_bloc_votes"
  | "unknown_party_letters"
  | "name_differs_between_sources"
  | "mock_2026";

export interface LocalityRecord {
  code: number;
  name_he: string;
  name_en: string | null;
  /** Every distinct name seen for this code across sources (for search and auditing). */
  names: string[];
  hasGeometry: boolean;
  /** CBS "religion of locality" field from the 2019 statistical-areas layer. */
  populationGroup: string | null;
  population2019: number | null;
  y2022: Year2022 | null;
  y2026: Year2026 | null;
  classification: Classification | null;
  /** 2026 bloc votes and balance from the 2026 results, using config/parties-2026.json (null without 2026 party votes). */
  blocVotes2026: BlocVotes | null;
  balance2026: number | null;
  /** balance2026 − classification.balance (2022): positive = shift toward the coalition. */
  balanceChange: number | null;
  turnoutChangePp: number | null;
  /** Analysed = has a classification (gray or blue–red) and a valid turnout change. */
  analysed: boolean;
  exclusionReasons: string[];
  warnings: LocalityWarning[];
}

export type DataMode = "official_partial" | "official_final" | "mock";

export interface SourceInfo {
  id: string;
  label: string;
  path: string;
  sha256: string;
  origin: string;
  notes: string;
}

export interface DatasetMeta {
  builtAt: string;
  mode: DataMode;
  modeNote: string;
  sources: SourceInfo[];
  turnoutDefinition: string;
  /** Which source wins for a 2026 box present in both. */
  primary2026: "feed" | "count";
  national: {
    y2022: { eligible: number; voters: number; doubleEnvelopeVoters: number; officialTurnoutPct: number; localityTurnoutPct: number };
    y2026: {
      eligibleRoster: number | null;
      eligibleCovered: number;
      voters: number;
      localityTurnoutPct: number;
      boxesRoster: number | null;
      boxesCount: number;
      boxesFeed: number;
      boxesMissing: number;
      feedNationalSample: { eligible: number; voters: number; pct: number } | null;
    };
  };
}

export interface QualityReport {
  counts: Record<string, number>;
  issues: { id: string; severity: "info" | "warning" | "error"; message: string; codes: number[] }[];
}

export interface Dataset {
  meta: DatasetMeta;
  parties: PartyDef[];
  parties2026: PartyDef[];
  localities: LocalityRecord[];
  quality: QualityReport;
}
