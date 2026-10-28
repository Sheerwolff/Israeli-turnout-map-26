// Readers for the raw CEC formats. Each returns plain records keyed by the
// official CBS/CEC locality code ("סמל ישוב"); no name matching happens here.

import { boxKey, parseCsvRecords } from "./csv";

/** Code the CEC uses for double ("external") envelopes, which are not attributed to any locality. */
export const DOUBLE_ENVELOPE_CODE = 9999;
/** Code of the "national sample" summary row in the CEC turnout feed. */
export const FEED_NATIONAL_ROW_CODE = 99999;

const COL = {
  committee: "סמל ועדה",
  name: "שם ישוב",
  code: "סמל ישוב",
  box: "קלפי",
  eligible: "בזב",
  voters: "מצביעים",
  invalid: "פסולים",
  valid: "כשרים",
} as const;
/** Non-party columns in CEC results files (expc = by locality, expb = by ballot box). */
const NON_PARTY = new Set<string>(["סמל ועדה", "ברזל", "שם ישוב", "סמל ישוב", "קלפי", "ריכוז", "שופט", "בזב", "מצביעים", "פסולים", "כשרים"]);

const int = (s: string | undefined, what: string): number => {
  const v = Number((s ?? "").replace(/,/g, ""));
  if (!Number.isFinite(v)) throw new Error(`not a number in ${what}: "${s}"`);
  return v;
};

export interface ResultsRow {
  code: number;
  name: string;
  box: string | null;
  eligible: number;
  voters: number;
  invalid: number;
  valid: number;
  votes: Record<string, number>;
}

export interface ResultsFile {
  level: "locality" | "box";
  partyLetters: string[];
  rows: ResultsRow[];
}

/** Reads a CEC results CSV, either per locality (expc) or per ballot box (expb). */
export function readResults(text: string): ResultsFile {
  const { header, records } = parseCsvRecords(text);
  for (const c of [COL.code, COL.name, COL.eligible, COL.voters, COL.invalid, COL.valid]) {
    if (!header.includes(c)) throw new Error(`results file is missing column "${c}"`);
  }
  const level = header.includes(COL.box) ? "box" : "locality";
  const partyLetters = header.filter((h) => !NON_PARTY.has(h));
  const rows = records.map((r, i) => {
    const where = `row ${i + 2}`;
    const votes: Record<string, number> = {};
    for (const l of partyLetters) votes[l] = int(r[l] || "0", `${where} ${l}`);
    return {
      code: int(r[COL.code], `${where} code`),
      name: r[COL.name].replace(/\s+/g, " ").trim(),
      box: level === "box" ? r[COL.box] : null,
      eligible: int(r[COL.eligible], `${where} eligible`),
      voters: int(r[COL.voters], `${where} voters`),
      invalid: int(r[COL.invalid], `${where} invalid`),
      valid: int(r[COL.valid], `${where} valid`),
      votes,
    };
  });
  return { level, partyLetters, rows };
}

export interface FeedRow {
  code: number;
  name: string;
  box: string;
  eligible: number;
  voters: number;
  /** "HH:MM" of the box's last report. */
  updated: string | null;
}

export interface TurnoutFeed {
  rows: FeedRow[];
  nationalSample: { eligible: number; voters: number; pct: number } | null;
}

/** Reads the CEC election-day turnout feed (per ballot box; Windows-1255 or UTF-8 text). */
export function readTurnoutFeed(text: string): TurnoutFeed {
  const { header, records } = parseCsvRecords(text);
  const pick = (cands: string[]) => {
    const h = header.find((x) => cands.includes(x));
    if (!h) throw new Error(`turnout feed is missing one of ${cands.join(" / ")}`);
    return h;
  };
  const cCode = pick(["סמל יישוב", "סמל ישוב"]);
  const cName = pick(["שם יישוב", "שם ישוב"]);
  const cBox = pick(["מס.קלפי", "קלפי"]);
  const cElig = pick(['בז"ב', "בזב"]);
  const cVoters = pick(["מצביעים"]);
  const cTime = header.find((x) => x.startsWith("שעת"));
  const rows: FeedRow[] = [];
  let nationalSample: TurnoutFeed["nationalSample"] = null;
  records.forEach((r, i) => {
    const code = int(r[cCode], `feed row ${i + 2} code`);
    const eligible = int(r[cElig], `feed row ${i + 2} eligible`);
    const voters = int(r[cVoters], `feed row ${i + 2} voters`);
    if (code === FEED_NATIONAL_ROW_CODE) {
      nationalSample = { eligible, voters, pct: eligible > 0 ? (voters / eligible) * 100 : NaN };
      return;
    }
    rows.push({ code, name: r[cName].replace(/\s+/g, " ").trim(), box: r[cBox], eligible, voters, updated: cTime ? r[cTime] || null : null });
  });
  return { rows, nationalSample };
}

export interface RosterRow {
  code: number;
  name: string;
  box: string;
  eligible: number;
}

/** Reads the roster CSV produced by scripts/geo/convert_roster.py. */
export function readRoster(text: string): RosterRow[] {
  const { header, records } = parseCsvRecords(text);
  for (const c of ["locality_code", "locality_name", "ballot_box", "eligible"]) {
    if (!header.includes(c)) throw new Error(`roster is missing column "${c}"`);
  }
  return records.map((r, i) => ({
    code: int(r.locality_code, `roster row ${i + 2}`),
    name: r.locality_name,
    box: r.ballot_box,
    eligible: int(r.eligible, `roster row ${i + 2} eligible`),
  }));
}

export { boxKey };

/** "HH:MM" ≥ cutoff "HH:MM" (both zero-padded). */
export function isAtOrAfter(time: string | null, cutoff: string): boolean {
  if (!time) return false;
  return time.padStart(5, "0") >= cutoff.padStart(5, "0");
}
