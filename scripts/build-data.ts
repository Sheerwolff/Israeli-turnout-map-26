// Data pipeline entry point: reads the raw files listed in config/sources.json,
// builds the analysed locality dataset and writes public/data/.
//
//   npm run build:data              official data as configured
//   npm run build:data:mock         keep the real 2022 data, replace 2026 with
//                                   clearly-labelled synthetic turnout (mock mode)

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDataset, DEFAULT_BUILD_OPTIONS, type BuildInputs, type GeometryInfo } from "../src/lib/build";
import { readResults, readRoster, readTurnoutFeed, type ResultsFile } from "../src/lib/ingest";
import { quantile } from "../src/lib/stats";
import type { Dataset, DataMode, PartyDef, SourceInfo } from "../src/lib/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");
const MOCK = process.argv.includes("--mock-2026");

interface SourceEntry {
  path: string;
  label: string;
  origin: string;
  notes: string;
  encoding?: string;
}
const sources = JSON.parse(readFileSync(join(ROOT, "config/sources.json"), "utf8")) as Record<string, SourceEntry> & { mode: DataMode; modeNote: string; primary2026?: "feed" | "count" };
const primary2026 = sources.primary2026 ?? "count";
const partyConfig = JSON.parse(readFileSync(join(ROOT, "config/parties-2022.json"), "utf8")) as { parties: PartyDef[] };

const used: SourceInfo[] = [];
function load(id: string): string {
  const s = sources[id] as SourceEntry | undefined;
  if (!s) throw new Error(`config/sources.json has no "${id}"`);
  const buf = readFileSync(join(ROOT, s.path));
  used.push({ id, label: s.label, path: s.path, sha256: createHash("sha256").update(buf).digest("hex"), origin: s.origin, notes: s.notes });
  return new TextDecoder(s.encoding ?? "utf-8").decode(buf);
}
const optional = (id: string) => (sources[id] ? load(id) : null);

// ---- Read --------------------------------------------------------------------------------------
const results2022 = readResults(load("results2022"));
const missingLetters = results2022.partyLetters.filter((l) => !partyConfig.parties.some((p) => p.letter === l));
if (missingLetters.length) {
  throw new Error(`2022 results contain party letters not in config/parties-2022.json: ${missingLetters.join(", ")}. Classify them explicitly before building.`);
}
const boxes2022Text = optional("results2022Boxes");

const geoText = load("geometry");
const geojson = JSON.parse(geoText) as { features: { properties: Record<string, unknown>; geometry: unknown }[] };
const geometry: GeometryInfo[] = geojson.features.map((f) => ({
  code: Number(f.properties.code),
  name_he: (f.properties.name_he as string) ?? null,
  name_en: (f.properties.name_en as string) ?? null,
  population_group: (f.properties.population_group as string) ?? null,
  population_2019: (f.properties.population_2019 as number) ?? null,
  hasGeometry: !!f.geometry,
}));

let inputs: BuildInputs;
let mode: DataMode = sources.mode;
let modeNote = sources.modeNote;
if (MOCK) {
  mode = "mock";
  modeNote = "MOCK MODE: 2026 turnout is synthetic (2022 turnout plus seeded random noise unrelated to politics). It is not an election result and must not be presented as one.";
  inputs = { parties: partyConfig.parties, results2022, results2026: mock2026(results2022), geometry };
  used.push({ id: "results2026", label: "Synthetic 2026 turnout (mock)", path: "(generated)", sha256: "-", origin: "scripts/build-data.ts --mock-2026", notes: "Seeded noise, σ ≈ 3 pp." });
} else {
  inputs = {
    parties: partyConfig.parties,
    results2022,
    results2022Boxes: boxes2022Text ? readResults(boxes2022Text) : undefined,
    results2026: readResults(load("results2026")),
    feed2026: sources.feed2026 ? readTurnoutFeed(load("feed2026")) : undefined,
    roster2026: sources.roster2026 ? readRoster(load("roster2026")) : undefined,
    geometry,
    options: { ...DEFAULT_BUILD_OPTIONS, primary2026 },
  };
}

// ---- Build -------------------------------------------------------------------------------------
const out = buildDataset(inputs);
if (MOCK) for (const l of out.localities) if (l.y2026) l.warnings.push("mock_2026");

const n22 = out.totals.y2022;
const official22 = n22.eligible > 0 ? ((n22.voters + n22.doubleEnvelopeVoters) / n22.eligible) * 100 : NaN;
const n26 = out.totals.y2026;
const dataset: Dataset = {
  meta: {
    builtAt: new Date().toISOString(),
    mode,
    modeNote,
    sources: used,
    primary2026: MOCK ? "count" : primary2026,
    turnoutDefinition:
      "Turnout = voters ÷ eligible voters × 100, per the CEC: 'voters' (מצביעים) are envelopes cast at the locality's ballot boxes (valid + invalid); 'eligible' (בזב) are registered voters assigned to those boxes. Double-envelope votes (soldiers, diplomats, prisoners, hospital patients, etc.; CEC code 9999) are counted centrally and not attributed to any locality, so locality turnout is lower than the national turnout. The same definition is used for both elections. turnout_change_pp = turnout_2026_pct − turnout_2022_pct.",
    national: {
      y2022: { eligible: n22.eligible, voters: n22.voters, doubleEnvelopeVoters: n22.doubleEnvelopeVoters, officialTurnoutPct: official22, localityTurnoutPct: (n22.voters / n22.eligible) * 100 },
      y2026: {
        eligibleRoster: n26.eligibleRoster,
        eligibleCovered: n26.eligibleCovered,
        voters: n26.voters,
        localityTurnoutPct: n26.eligibleCovered > 0 ? (n26.voters / n26.eligibleCovered) * 100 : NaN,
        boxesRoster: n26.boxesRoster,
        boxesCount: n26.boxesCount,
        boxesFeed: n26.boxesFeed,
        boxesMissing: n26.boxesMissing,
        feedNationalSample: inputs.feed2026?.nationalSample ?? null,
      },
    },
  },
  parties: out.parties,
  localities: out.localities,
  quality: out.quality,
};

// ---- Write -------------------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "dataset.json"), JSON.stringify(dataset));
const geomOut = {
  type: "FeatureCollection",
  features: geojson.features.filter((f) => f.geometry).map((f) => ({ type: "Feature", id: Number(f.properties.code), properties: { code: Number(f.properties.code) }, geometry: f.geometry })),
};
writeFileSync(join(OUT, "geometry.geojson"), JSON.stringify(geomOut));

// ---- Report ------------------------------------------------------------------------------------
const c = out.quality.counts;
console.log(`mode: ${mode}`);
for (const [k, v] of Object.entries(c)) console.log(`  ${k.padEnd(34)} ${v}`);
for (const i of out.quality.issues) console.log(`  [${i.severity}] ${i.id}: ${i.message}${i.codes.length ? ` (${i.codes.length})` : ""}`);
const abs = out.localities.filter((l) => l.analysed).map((l) => Math.abs(l.turnoutChangePp!));
console.log(`  |Δ turnout| percentiles (analysed): p50 ${quantile(abs, 0.5)?.toFixed(2)}  p90 ${quantile(abs, 0.9)?.toFixed(2)}  p95 ${quantile(abs, 0.95)?.toFixed(2)}  p99 ${quantile(abs, 0.99)?.toFixed(2)}  max ${Math.max(...abs).toFixed(2)}`);
const errors = out.quality.issues.filter((i) => i.severity === "error");
if (errors.length) {
  console.error(`${errors.length} data-quality error(s); see above.`);
  process.exitCode = 1;
}

// ---- Mock 2026 -----------------------------------------------------------------------------------
function mock2026(r22: ResultsFile): ResultsFile {
  // Deterministic PRNG (mulberry32) seeded per locality code, Box–Muller normal noise.
  const rand = (seed: number) => {
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rows = r22.rows.map((r) => {
    const u1 = Math.max(rand(r.code * 2 + 1), 1e-9);
    const u2 = rand(r.code * 2 + 2);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const eligible = r.eligible;
    const t22 = eligible > 0 ? r.voters / eligible : 0;
    const t26 = Math.min(0.99, Math.max(0.05, t22 + z * 0.03));
    const voters = Math.round(eligible * t26);
    return { ...r, box: null, voters, invalid: 0, valid: voters, votes: {} };
  });
  return { level: "locality", partyLetters: [], rows };
}
