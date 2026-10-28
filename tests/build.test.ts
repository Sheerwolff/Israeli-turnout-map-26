import { describe, expect, it } from "vitest";
import { buildDataset, type GeometryInfo } from "../src/lib/build";
import { parseCsv } from "../src/lib/csv";
import { readResults, readTurnoutFeed } from "../src/lib/ingest";
import { boxStats, groupSummaries, median, overallSummary } from "../src/lib/stats";
import { ANALYSIS_CONFIG } from "../src/config/analysis";
import type { PartyDef } from "../src/lib/types";

const parties: PartyDef[] = [
  { letter: "מחל", name_he: "", name_en: "Likud", group: "pro_netanyahu" },
  { letter: "פה", name_he: "", name_en: "Yesh Atid", group: "anti_netanyahu" },
  { letter: "עם", name_he: "", name_en: "Ra'am", group: "arab_parties" },
];

const expc22 = [
  "סמל ועדה,שם ישוב,סמל ישוב,בזב,מצביעים,פסולים,כשרים,מחל,פה,עם",
  "1,אלפא,10,1000,600,0,600,400,200,0",
  "1,בטא,20,1000,700,10,690,100,500,90",
  "1,גמא,30,500,250,0,250,20,30,200",
  "1,דלתא,40,100,50,0,50,25,25,0",
  "99,מעטפות חיצוניות,9999,0,80,0,80,40,40,0",
].join("\n");

// Box-level 2026 count: locality 10 fully counted; 20 has one box counted, one only in the feed; 30 has nothing counted.
const expb26 = [
  "סמל ועדה,ברזל,שם ישוב,סמל ישוב,קלפי,ריכוז,שופט,בזב,מצביעים,פסולים,כשרים,X",
  "1,1,אלפא,10,1,1,0,500,350,0,350,350",
  "1,2,אלפא,10,2,1,0,500,350,0,350,350",
  "1,3,בטא,20,1,1,0,500,300,0,300,300",
  "1,4,דלתא,40,1,1,0,100,60,0,60,60",
  "1,5,חדש,50,1,1,0,100,70,0,70,70",
].join("\n");

const feed = [
  'סמל יישוב,שם יישוב,מס.קלפי,ברזל,"בז""ב",מצביעים,אחוז הצבעה,שעת עידכון',
  "20,בטא,2,4,500,250,50%,22:10",
  "30,גמא,1,6,500,300,60%,19:05",
  "99999,מדגם ארצי,99999,99999,1600,1000,62.5%,",
].join("\n");

const geometry: GeometryInfo[] = [10, 20, 30, 60].map((code) => ({ code, name_he: `g${code}`, name_en: null, population_group: null, population_2019: null, hasGeometry: true }));

const build = () =>
  buildDataset({
    parties,
    results2022: readResults(expc22),
    results2026: readResults(expb26),
    feed2026: readTurnoutFeed(feed),
    roster2026: [
      { code: 10, name: "", box: "1", eligible: 500 },
      { code: 10, name: "", box: "2.0", eligible: 500 },
      { code: 20, name: "", box: "1", eligible: 500 },
      { code: 20, name: "", box: "2", eligible: 500 },
      { code: 30, name: "", box: "1", eligible: 500 },
      { code: 40, name: "", box: "1", eligible: 100 },
      { code: 40, name: "", box: "2", eligible: 100 },
    ],
    geometry,
  });

describe("dataset build", () => {
  const out = build();
  const byCode = new Map(out.localities.map((l) => [l.code, l]));

  it("excludes double envelopes from localities and reports them", () => {
    expect(byCode.has(9999)).toBe(false);
    expect(out.totals.y2022.doubleEnvelopeVoters).toBe(80);
    expect(out.quality.issues.some((i) => i.id === "double_envelopes_2022")).toBe(true);
  });

  it("computes turnout change in pp from the count", () => {
    const a = byCode.get(10)!;
    expect(a.y2022!.turnoutPct).toBe(60);
    expect(a.y2026!.turnoutPct).toBe(70);
    expect(a.turnoutChangePp).toBe(10);
    expect(a.y2026!.coverage).toBe(1);
    expect(a.analysed).toBe(true);
  });

  it("fills uncounted boxes from the feed and flags it", () => {
    const b = byCode.get(20)!;
    expect(b.y2026!.boxesCount).toBe(1);
    expect(b.y2026!.boxesFeed).toBe(1);
    expect(b.y2026!.turnoutPct).toBeCloseTo(55, 9);
    expect(b.warnings).toContain("uses_preliminary_feed");
  });

  it("marks stale feed boxes", () => {
    const g = byCode.get(30)!;
    expect(g.y2026!.boxesFeedStale).toBe(1);
    expect(g.warnings).toContain("uses_stale_feed");
    expect(g.classification!.isArabPlurality).toBe(true);
  });

  it("reports partial coverage against the roster", () => {
    const d = byCode.get(40)!;
    expect(d.y2026!.coverage).toBe(0.5);
    expect(d.y2026!.boxesMissing).toBe(1);
    expect(d.warnings).toContain("partial_2026_coverage");
  });

  it("keeps unmatched localities and geometry visible in the quality report", () => {
    const n = byCode.get(50)!;
    expect(n.analysed).toBe(false);
    expect(n.exclusionReasons).toContain("no 2022 results");
    expect(n.warnings).toContain("no_geometry");
    const ids = out.quality.issues.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["only_in_2026", "election_records_without_geometry", "geometry_without_election_data"]));
    expect(out.quality.issues.find((i) => i.id === "geometry_without_election_data")!.codes).toEqual([60]);
  });

  it("does not report the feed's national-sample row as a locality", () => {
    expect(readTurnoutFeed(feed).nationalSample?.voters).toBe(1000);
    expect(byCode.has(99999)).toBe(false);
  });

  it("dashboard summaries distinguish unweighted and voter-weighted change", () => {
    const s = overallSummary(out.localities, ANALYSIS_CONFIG);
    expect(s.analysed).toBe(out.localities.filter((l) => l.analysed).length);
    const changes = out.localities.filter((l) => l.analysed).map((l) => l.turnoutChangePp!);
    expect(s.meanChangePp).toBeCloseTo(changes.reduce((a, b) => a + b, 0) / changes.length);
    expect(s.aggregateChangePp).not.toBeCloseTo(s.meanChangePp!);
    const groups = groupSummaries(out.localities, ANALYSIS_CONFIG);
    expect(groups.find((g) => g.group === "gray")!.n).toBe(1);
  });
});

describe("stats and csv helpers", () => {
  it("median and box stats", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const b = boxStats([1, 2, 3, 4, 100])!;
    expect(b.outliers).toEqual([100]);
    expect(b.whiskerHigh).toBe(4);
  });
  it("parses quoted fields and BOM", () => {
    expect(parseCsv('﻿a,"b ""c""",d\r\n1,2,3\n')).toEqual([["a", 'b "c"', "d"], ["1", "2", "3"]]);
  });
});
