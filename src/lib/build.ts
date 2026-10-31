// Assembles locality records from parsed inputs: per-locality aggregation,
// 2026 ballot-box source resolution, joins on the official locality code,
// classification, turnout change and data-quality checks. Pure (no I/O).

import { buildRegistry, classifyLocality } from "./classification";
import { boxKey, DOUBLE_ENVELOPE_CODE, isAtOrAfter, type ResultsFile, type ResultsRow, type RosterRow, type TurnoutFeed } from "./ingest";
import { turnoutChangePp, turnoutPct } from "./turnout";
import type { LocalityRecord, LocalityWarning, PartyDef, QualityReport, Year2022, Year2026 } from "./types";

export interface GeometryInfo {
  code: number;
  name_he: string | null;
  name_en: string | null;
  population_group: string | null;
  population_2019: number | null;
  hasGeometry: boolean;
}

export interface BuildOptions {
  /** Which 2026 source wins for a box present in both: the election-day turnout feed or the vote count. */
  primary2026: "feed" | "count";
  /** Feed boxes whose last report is earlier than this "HH:MM" are marked stale. */
  staleFeedBefore: string;
  /** Coverage of the 2026 roster electorate below this share raises a partial-count warning. */
  partialCoverageBelow: number;
  maxUnknownShare: number;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { primary2026: "count", staleFeedBefore: "21:30", partialCoverageBelow: 0.98, maxUnknownShare: 0.05 };

export interface BuildInputs {
  parties: PartyDef[];
  /** 2026 party-group mapping, used only for the 2026 balance. */
  parties2026?: PartyDef[];
  /** Official 2022 results by locality (expc) or by box (expb). */
  results2022: ResultsFile;
  /** Optional box-level 2022 file, used only to cross-check results2022. */
  results2022Boxes?: ResultsFile;
  /** 2026 counted results (box-level partial count, or a final file of either level). */
  results2026: ResultsFile;
  /** Optional 2026 election-day turnout feed (primary or fallback, per options.primary2026). */
  feed2026?: TurnoutFeed;
  /** Optional 2026 roster of all ballot boxes, used to measure coverage. */
  roster2026?: RosterRow[];
  geometry: GeometryInfo[];
  options?: BuildOptions;
}

export interface BuildOutput {
  localities: LocalityRecord[];
  quality: QualityReport;
  parties: PartyDef[];
  parties2026: PartyDef[];
  totals: {
    y2022: { eligible: number; voters: number; doubleEnvelopeVoters: number };
    y2026: {
      eligibleRoster: number | null;
      eligibleCovered: number;
      voters: number;
      boxesRoster: number | null;
      boxesCount: number;
      boxesFeed: number;
      boxesMissing: number;
      doubleEnvelopeVoters: number;
    };
  };
}

const normName = (s: string) => s.replace(/[\s\-–־'"`׳״()]/g, "");

interface Agg2022 {
  name: string;
  eligible: number;
  voters: number;
  invalid: number;
  valid: number;
  votes: Record<string, number>;
}

function aggregateByLocality(rows: ResultsRow[]): Map<number, Agg2022> {
  const out = new Map<number, Agg2022>();
  for (const r of rows) {
    let a = out.get(r.code);
    if (!a) {
      a = { name: r.name, eligible: 0, voters: 0, invalid: 0, valid: 0, votes: {} };
      out.set(r.code, a);
    }
    a.eligible += r.eligible;
    a.voters += r.voters;
    a.invalid += r.invalid;
    a.valid += r.valid;
    for (const [l, n] of Object.entries(r.votes)) a.votes[l] = (a.votes[l] ?? 0) + n;
  }
  return out;
}

function duplicates<T>(items: T[], key: (t: T) => string | number): (string | number)[] {
  const seen = new Set<string | number>();
  const dup = new Set<string | number>();
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}

export function buildDataset(input: BuildInputs): BuildOutput {
  const opt = input.options ?? DEFAULT_BUILD_OPTIONS;
  const registry = buildRegistry(input.parties);
  const issues: QualityReport["issues"] = [];
  const issue = (id: string, severity: "info" | "warning" | "error", message: string, codes: number[] = []) => {
    issues.push({ id, severity, message, codes: [...new Set(codes)].sort((a, b) => a - b) });
  };

  // ---- Party configuration vs. file -------------------------------------------------------
  const letters22 = input.results2022.partyLetters;
  const unknown = letters22.filter((l) => !registry.has(l));
  if (unknown.length) issue("unclassified_party_letters", "error", `Party letters in the 2022 results missing from config/parties-2022.json: ${unknown.join(", ")}. Their votes count as other_or_unclassified.`);
  const unused = input.parties.filter((p) => !letters22.includes(p.letter)).map((p) => p.letter);
  if (unused.length) issue("config_letters_not_in_results", "warning", `Letters in config/parties-2022.json with no column in the 2022 results: ${unused.join(", ")}.`);

  // ---- 2022 ----------------------------------------------------------------------------------
  const rows22 = input.results2022.rows;
  if (input.results2022.level === "locality") {
    const d = duplicates(rows22, (r) => r.code) as number[];
    if (d.length) issue("duplicate_codes_2022", "error", "Duplicate locality codes in the 2022 results (rows were summed).", d);
  } else {
    const d = duplicates(rows22, (r) => boxKey(r.code, r.box ?? ""));
    if (d.length) issue("duplicate_boxes_2022", "error", `Duplicate ballot boxes in the 2022 results: ${d.slice(0, 20).join(", ")}`);
  }
  const arith22 = rows22.filter((r) => r.voters !== r.valid + r.invalid || Object.values(r.votes).reduce((a, b) => a + b, 0) !== r.valid);
  if (arith22.length) issue("arithmetic_2022", "error", "2022 rows where voters ≠ valid + invalid, or party votes ≠ valid votes.", arith22.map((r) => r.code));

  const all22 = aggregateByLocality(rows22);
  const env22 = all22.get(DOUBLE_ENVELOPE_CODE);
  all22.delete(DOUBLE_ENVELOPE_CODE);
  if (env22) issue("double_envelopes_2022", "info", `${env22.voters.toLocaleString("en")} double-envelope votes (code ${DOUBLE_ENVELOPE_CODE}) are not attributed to any locality and are excluded from locality turnout.`);

  if (input.results2022Boxes) {
    const boxes = aggregateByLocality(input.results2022Boxes.rows);
    boxes.delete(DOUBLE_ENVELOPE_CODE);
    const bad: number[] = [];
    for (const code of new Set([...boxes.keys(), ...all22.keys()])) {
      const a = all22.get(code);
      const b = boxes.get(code);
      if (!a || !b || a.eligible !== b.eligible || a.voters !== b.voters || a.valid !== b.valid) bad.push(code);
    }
    if (bad.length) issue("cross_check_2022_boxes", "error", "Localities where the 2022 ballot-box file does not add up to the 2022 locality file.", bad);
    else issue("cross_check_2022_boxes", "info", `2022 ballot-box file (${input.results2022Boxes.rows.length.toLocaleString("en")} rows) adds up exactly to the locality file for all ${all22.size} localities.`);
  }

  // ---- 2026 ----------------------------------------------------------------------------------
  const res26 = input.results2026;
  const rows26 = res26.rows.filter((r) => r.code !== DOUBLE_ENVELOPE_CODE);
  const env26 = res26.rows.filter((r) => r.code === DOUBLE_ENVELOPE_CODE).reduce((s, r) => s + r.voters, 0);
  if (env26) issue("double_envelopes_2026", "info", `${env26.toLocaleString("en")} double-envelope votes in the 2026 count are excluded from locality turnout.`);

  interface Box26 {
    code: number;
    name: string;
    eligible: number;
    voters: number;
    source: "count" | "feed" | "feed_stale" | "missing";
    rosterEligible: number | null;
  }
  const boxes26 = new Map<string, Box26>();
  const loc26Totals = new Map<number, { name: string; eligible: number; voters: number }>();

  const roster = input.roster2026 ?? null;
  if (roster) {
    const d = duplicates(roster, (r) => boxKey(r.code, r.box));
    if (d.length) issue("duplicate_boxes_roster_2026", "error", `Duplicate boxes in the 2026 roster: ${d.slice(0, 20).join(", ")}`);
  }
  const rosterByKey = new Map((roster ?? []).map((r) => [boxKey(r.code, r.box), r]));

  const primary = opt.primary2026;
  const countBoxes = new Map<string, Box26>();
  const feedBoxes = new Map<string, Box26>();
  if (res26.level === "box") {
    const d = duplicates(rows26, (r) => boxKey(r.code, r.box ?? ""));
    if (d.length) issue("duplicate_boxes_2026", "error", `Duplicate ballot boxes in the 2026 count: ${d.slice(0, 20).join(", ")}`);
    for (const r of rows26) {
      countBoxes.set(boxKey(r.code, r.box ?? ""), { code: r.code, name: r.name, eligible: r.eligible, voters: r.voters, source: "count", rosterEligible: null });
    }
  } else {
    const d = duplicates(rows26, (r) => r.code) as number[];
    if (d.length) issue("duplicate_codes_2026", "error", "Duplicate locality codes in the 2026 results (rows were summed).", d);
    for (const r of rows26) {
      const t = loc26Totals.get(r.code) ?? { name: r.name, eligible: 0, voters: 0 };
      t.eligible += r.eligible;
      t.voters += r.voters;
      loc26Totals.set(r.code, t);
    }
  }
  if (input.feed2026) {
    const d2 = duplicates(input.feed2026.rows, (r) => boxKey(r.code, r.box));
    if (d2.length) issue("duplicate_boxes_feed_2026", "error", `Duplicate boxes in the 2026 turnout feed: ${d2.slice(0, 20).join(", ")}`);
    for (const f of input.feed2026.rows) {
      const stale = !isAtOrAfter(f.updated, opt.staleFeedBefore);
      feedBoxes.set(boxKey(f.code, f.box), { code: f.code, name: f.name, eligible: f.eligible, voters: f.voters, source: stale ? "feed_stale" : "feed", rosterEligible: null });
    }
    const eligMismatch = [...feedBoxes].filter(([k, f]) => countBoxes.has(k) && countBoxes.get(k)!.eligible !== f.eligible).map(([, f]) => f.code);
    if (eligMismatch.length) issue("feed_vs_count_eligible_2026", "warning", "Boxes whose eligible-voter count differs between the 2026 turnout feed and the count.", eligMismatch);
  }
  if (primary === "feed" && !feedBoxes.size) throw new Error("primary2026 is 'feed' but no turnout feed was provided");

  // Per box: the primary source if it has the box, else the other source, else "missing" (roster only).
  const useBoxes = res26.level === "box" || primary === "feed";
  if (useBoxes) {
    const [first, second] = primary === "feed" ? [feedBoxes, countBoxes] : [countBoxes, feedBoxes];
    for (const k of new Set([...first.keys(), ...second.keys(), ...rosterByKey.keys()])) {
      const b = first.get(k) ?? second.get(k);
      const r = rosterByKey.get(k);
      boxes26.set(k, b ? { ...b, rosterEligible: r?.eligible ?? null } : { code: r!.code, name: r!.name, eligible: 0, voters: 0, source: "missing", rosterEligible: r!.eligible });
    }
    if (roster) {
      const notInRoster = [...boxes26.entries()].filter(([k, b]) => b.source !== "missing" && !rosterByKey.has(k)).map(([, b]) => b.code);
      if (notInRoster.length) issue("boxes_not_in_roster_2026", "warning", `${notInRoster.length} ballot boxes with 2026 data are not on the 2026 roster.`, notInRoster);
    }
    if (res26.level === "locality") issue("count_not_merged_2026", "info", "The 2026 count is a locality-level file, so it cannot fill individual boxes missing from the turnout feed.");
  }

  const y2026 = new Map<number, Year2026>();
  if (useBoxes) {
    const byLoc = new Map<number, Box26[]>();
    for (const b of boxes26.values()) {
      const arr = byLoc.get(b.code) ?? [];
      arr.push(b);
      byLoc.set(b.code, arr);
    }
    for (const [code, bs] of byLoc) {
      const withData = bs.filter((b) => b.source !== "missing");
      const eligible = withData.reduce((s, b) => s + b.eligible, 0);
      const voters = withData.reduce((s, b) => s + b.voters, 0);
      const feedElig = withData.filter((b) => b.source !== "count").reduce((s, b) => s + b.eligible, 0);
      const staleElig = withData.filter((b) => b.source === "feed_stale").reduce((s, b) => s + b.eligible, 0);
      const rosterEligible = roster ? bs.reduce((s, b) => s + (b.rosterEligible ?? 0), 0) : null;
      const inRoster = bs.filter((b) => b.rosterEligible !== null).length;
      y2026.set(code, {
        name: (withData[0] ?? bs[0]).name,
        eligible,
        voters,
        turnoutPct: turnoutPct(voters, eligible).pct,
        rosterEligible,
        coverage: rosterEligible ? Math.min(1, eligible / rosterEligible) : null,
        boxesRoster: roster ? inRoster : null,
        boxesCount: bs.filter((b) => b.source === "count").length,
        boxesFeed: bs.filter((b) => b.source === "feed" || b.source === "feed_stale").length,
        boxesFeedStale: bs.filter((b) => b.source === "feed_stale").length,
        boxesMissing: bs.filter((b) => b.source === "missing").length,
        feedShare: eligible > 0 ? feedElig / eligible : 0,
        staleFeedShare: eligible > 0 ? staleElig / eligible : 0,
      });
    }
  } else {
    const rosterByLoc = new Map<number, { e: number; n: number }>();
    for (const r of roster ?? []) {
      const t = rosterByLoc.get(r.code) ?? { e: 0, n: 0 };
      t.e += r.eligible;
      t.n += 1;
      rosterByLoc.set(r.code, t);
    }
    for (const [code, t] of loc26Totals) {
      const ro = rosterByLoc.get(code);
      y2026.set(code, {
        name: t.name,
        eligible: t.eligible,
        voters: t.voters,
        turnoutPct: turnoutPct(t.voters, t.eligible).pct,
        rosterEligible: ro ? ro.e : null,
        coverage: ro && ro.e ? Math.min(1, t.eligible / ro.e) : null,
        boxesRoster: ro ? ro.n : null,
        boxesCount: 0,
        boxesFeed: 0,
        boxesFeedStale: 0,
        boxesMissing: 0,
        feedShare: 0,
        staleFeedShare: 0,
      });
    }
  }

  // ---- 2026 bloc votes (for the 2026 balance) --------------------------------------------------
  const votes26 = new Map<number, Record<string, number>>();
  const registry26 = input.parties2026 ? buildRegistry(input.parties2026) : null;
  if (registry26) {
    const unknown26 = res26.partyLetters.filter((l) => !registry26.has(l));
    if (unknown26.length) issue("unclassified_party_letters_2026", "error", `Party letters in the 2026 results missing from config/parties-2026.json: ${unknown26.join(", ")}.`);
    for (const r of rows26) {
      const v = votes26.get(r.code) ?? {};
      for (const [l, n] of Object.entries(r.votes)) v[l] = (v[l] ?? 0) + n;
      votes26.set(r.code, v);
    }
  }

  // ---- Geometry ------------------------------------------------------------------------------
  const geoDup = duplicates(input.geometry, (g) => g.code) as number[];
  if (geoDup.length) issue("duplicate_codes_geometry", "error", "Duplicate locality codes in the boundary layer.", geoDup);
  const geo = new Map(input.geometry.map((g) => [g.code, g]));
  const badGeo = input.geometry.filter((g) => !g.hasGeometry).map((g) => g.code);
  if (badGeo.length) issue("invalid_geometry", "warning", "Boundary features with missing or empty geometry.", badGeo);

  // ---- Join ----------------------------------------------------------------------------------
  const codes = new Set<number>([...all22.keys(), ...y2026.keys()]);
  const localities: LocalityRecord[] = [];
  for (const code of [...codes].sort((a, b) => a - b)) {
    const a = all22.get(code) ?? null;
    const b = y2026.get(code) ?? null;
    const g = geo.get(code) ?? null;
    const warnings: LocalityWarning[] = [];
    const exclusionReasons: string[] = [];

    let y22: Year2022 | null = null;
    if (a) {
      const t = turnoutPct(a.voters, a.eligible);
      y22 = { name: a.name, eligible: a.eligible, voters: a.voters, invalid: a.invalid, valid: a.valid, turnoutPct: t.pct, votes: a.votes };
      if (t.pct === null) {
        warnings.push("invalid_turnout_2022");
        exclusionReasons.push(`2022 turnout unusable (${t.issue})`);
      }
    } else {
      warnings.push("missing_2022");
      exclusionReasons.push("no 2022 results");
    }
    if (b) {
      if (b.turnoutPct === null) {
        warnings.push("invalid_turnout_2026");
        exclusionReasons.push(b.eligible === 0 ? "no 2026 ballot boxes reported yet" : "2026 turnout unusable");
      }
      if (b.coverage !== null && b.coverage < opt.partialCoverageBelow) warnings.push("partial_2026_coverage");
      if (primary === "count" && b.boxesFeed > 0) warnings.push("uses_preliminary_feed");
      if (primary === "feed" && b.boxesCount > 0) warnings.push("uses_count_fallback");
      if (b.boxesFeedStale > 0) warnings.push("uses_stale_feed");
    } else {
      warnings.push("missing_2026");
      exclusionReasons.push("no 2026 data");
    }

    const classification = a ? classifyLocality(a.votes, registry, { maxUnknownShare: opt.maxUnknownShare }) : null;
    if (classification) {
      if (classification.isTopTie) warnings.push("top_party_tie");
      if (classification.flags.includes("no_bloc_votes")) warnings.push("no_bloc_votes");
      if (classification.unknownLetters.length) warnings.push("unknown_party_letters");
      if (classification.category === "unavailable") exclusionReasons.push("political balance unavailable (no votes for either bloc, or insufficient party classification)");
    }
    if (!g || !g.hasGeometry) warnings.push("no_geometry");

    const v26 = votes26.get(code);
    const c26 = registry26 && v26 ? classifyLocality(v26, registry26, { maxUnknownShare: opt.maxUnknownShare }) : null;
    const balance2026 = c26?.balance ?? null;
    const balance2022 = classification?.balance ?? null;
    const balanceChange = balance2026 !== null && balance2022 !== null ? balance2026 - balance2022 : null;

    const names = [...new Set([g?.name_he, a?.name, b?.name].filter((x): x is string => !!x))];
    if (a && b && normName(a.name) !== normName(b.name)) warnings.push("name_differs_between_sources");

    const turnoutChange = turnoutChangePp(y22?.turnoutPct ?? null, b?.turnoutPct ?? null);
    const analysed = exclusionReasons.length === 0 && turnoutChange !== null;

    localities.push({
      code,
      name_he: g?.name_he ?? a?.name ?? b?.name ?? String(code),
      name_en: g?.name_en ?? null,
      names,
      hasGeometry: !!g?.hasGeometry,
      populationGroup: g?.population_group ?? null,
      population2019: g?.population_2019 ?? null,
      y2022: y22,
      y2026: b,
      classification,
      blocVotes2026: c26?.blocVotes ?? null,
      balance2026,
      balanceChange,
      turnoutChangePp: turnoutChange,
      analysed,
      exclusionReasons,
      warnings,
    });
  }

  // ---- Quality report ------------------------------------------------------------------------
  const byWarn = (w: LocalityWarning) => localities.filter((l) => l.warnings.includes(w)).map((l) => l.code);
  const only22 = localities.filter((l) => l.y2022 && !l.y2026).map((l) => l.code);
  const only26 = localities.filter((l) => !l.y2022 && l.y2026).map((l) => l.code);
  if (only22.length) issue("only_in_2022", "warning", "Localities with 2022 results but no 2026 data.", only22);
  if (only26.length) issue("only_in_2026", "warning", "Localities with 2026 data but no 2022 results (new localities or new codes); they cannot be classified.", only26);
  const noGeo = byWarn("no_geometry");
  if (noGeo.length) issue("election_records_without_geometry", "warning", "Localities with election data but no boundary polygon (not drawn on the map; still included in summaries).", noGeo);
  const geoNoData = input.geometry.filter((g) => !codes.has(g.code)).map((g) => g.code);
  if (geoNoData.length) issue("geometry_without_election_data", "info", "Boundary polygons with no matching election record (drawn as outlines only).", geoNoData);
  const ties = byWarn("top_party_tie");
  if (ties.length) issue("top_party_ties", "warning", "Localities where two or more parties tied for the most votes in 2022 (tie rule applied; inspect).", ties);
  const noBloc = byWarn("no_bloc_votes");
  if (noBloc.length) issue("no_bloc_votes", "warning", "Localities with no votes for either defined bloc in 2022 (balance unavailable).", noBloc);
  const inv = [...byWarn("invalid_turnout_2022"), ...byWarn("invalid_turnout_2026")];
  if (inv.length) issue("invalid_turnout", "warning", "Localities with a missing denominator or a turnout outside 0–100%.", inv);
  const partial = byWarn("partial_2026_coverage");
  if (partial.length) issue("partial_2026_coverage", "warning", `Localities where the 2026 data cover less than ${Math.round(opt.partialCoverageBelow * 100)}% of the roster electorate.`, partial);
  const feed = byWarn("uses_preliminary_feed");
  if (feed.length) issue("uses_preliminary_feed", "warning", "Localities where some 2026 boxes are not yet in the count and use the preliminary 22:00 turnout feed instead.", feed);
  const fallback = byWarn("uses_count_fallback");
  if (fallback.length) issue("uses_count_fallback", "warning", "Localities where some 2026 boxes are missing from the turnout feed and use the counted figure instead.", fallback);
  const stale = byWarn("uses_stale_feed");
  if (stale.length) issue("uses_stale_feed", "warning", `Localities using feed boxes last updated before ${opt.staleFeedBefore}. A feed figure is the box's last report, so an early last update under-states turnout (by about 3% for boxes last updated 20:00–21:29, by much more for earlier ones).`, stale);
  const renamed = byWarn("name_differs_between_sources");
  if (renamed.length) issue("name_differs", "info", "Localities whose 2022 and 2026 CEC names differ (joined by code, not by name).", renamed);

  const allBoxes = [...boxes26.values()];
  const counts: Record<string, number> = {
    localities_total: localities.length,
    localities_in_2022: all22.size,
    localities_in_2026: y2026.size,
    localities_in_both_elections: localities.filter((l) => l.y2022 && l.y2026).length,
    localities_with_geometry: localities.filter((l) => l.hasGeometry).length,
    localities_without_geometry: noGeo.length,
    geometry_features: input.geometry.length,
    geometry_without_election_data: geoNoData.length,
    analysed: localities.filter((l) => l.analysed).length,
    analysed_on_map: localities.filter((l) => l.analysed && l.hasGeometry).length,
    excluded: localities.filter((l) => !l.analysed).length,
    gray_arab_plurality: localities.filter((l) => l.classification?.isArabPlurality).length,
    top_party_ties: ties.length,
    no_bloc_votes: noBloc.length,
    partial_2026_coverage: partial.length,
    boxes_2026_count: allBoxes.filter((b) => b.source === "count").length,
    boxes_2026_feed: allBoxes.filter((b) => b.source === "feed").length,
    boxes_2026_feed_stale: allBoxes.filter((b) => b.source === "feed_stale").length,
    boxes_2026_missing: allBoxes.filter((b) => b.source === "missing").length,
  };

  const parties = input.parties.map((p) => ({ ...p, national_votes: rows22.filter((r) => r.code !== DOUBLE_ENVELOPE_CODE).reduce((s, r) => s + (r.votes[p.letter] ?? 0), 0) }));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

  return {
    localities,
    quality: { counts, issues },
    parties,
    parties2026: (input.parties2026 ?? []).map((p) => ({ ...p, national_votes: rows26.reduce((t, r) => t + (r.votes[p.letter] ?? 0), 0) })),
    totals: {
      y2022: { eligible: sum([...all22.values()].map((a) => a.eligible)), voters: sum([...all22.values()].map((a) => a.voters)), doubleEnvelopeVoters: env22?.voters ?? 0 },
      y2026: {
        eligibleRoster: roster ? sum(roster.map((r) => r.eligible)) : null,
        eligibleCovered: sum([...y2026.values()].map((y) => y.eligible)),
        voters: sum([...y2026.values()].map((y) => y.voters)),
        boxesRoster: roster ? roster.length : null,
        boxesCount: counts.boxes_2026_count,
        boxesFeed: counts.boxes_2026_feed + counts.boxes_2026_feed_stale,
        boxesMissing: counts.boxes_2026_missing,
        doubleEnvelopeVoters: env26,
      },
    },
  };
}
