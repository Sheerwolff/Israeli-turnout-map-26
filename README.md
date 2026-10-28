# Israel: 2022 political composition × turnout change 2022→2026

An interactive analytical map of Israeli localities. Each locality's color encodes two independent things:

- **Hue: how it voted in 2022.** Continuous from blue (anti-Netanyahu) through purple to red (pro-Netanyahu), using `political_balance = (pro − anti) / (pro + anti)`. Localities where an Arab party was the single most-voted-for party are **gray**. The hue never depends on 2026 votes.
- **Lightness: change in turnout from 2022 to 2026, in percentage points.** Darker means turnout rose; lighter means it fell. The scale is symmetric, shared by every locality, and configurable.

The app answers one question: *did turnout change differently across localities with different 2022 political compositions?* It provides a two-dimensional interactive legend, hover tooltips, a detail panel for each locality, search in Hebrew and English, filters, a dashboard (overall change, a scatter plot of balance against change, group box plots), and a data-quality report that lists every unmatched or excluded locality.

> **Data status (28 Oct 2026):** the 2022 data are final official CEC results. The 2026 data are the CEC's **partial count** (11,168 of 12,018 ballot boxes), filled in with the CEC's preliminary 22:00 turnout feed for boxes not yet counted. The app says so in its header, and flags every affected locality.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # classification, turnout, color and pipeline tests
npm run build        # typecheck + production build in dist/
```

The processed data are committed in `public/data/`, so the app runs without the pipeline. To rebuild them, run `npm run build:data`. For a clearly labelled synthetic 2026 dataset, run `npm run build:data:mock`.

## Layout

| Path | Concern |
|---|---|
| `data/raw/` | Raw official inputs (CEC results, turnout feed, roster) |
| `data/geo/` | Locality polygons derived from the CBS layer |
| `config/parties-2022.json` | **Party → group mapping**, the single auditable source of truth |
| `config/sources.json` | Input files, provenance, data mode |
| `src/config/analysis.ts` | Color-scale bound and direction, summary cut-offs, "unchanged" threshold |
| `src/lib/ingest.ts`, `csv.ts` | Raw data ingestion (CEC formats) |
| `src/lib/classification.ts` | Top party, Arab-plurality rule, political balance |
| `src/lib/turnout.ts` | Turnout and change in pp |
| `src/lib/build.ts` | Cleaning, 2026 box-source resolution, code-based joins, quality checks |
| `src/lib/color.ts` | Pure color function (OKLCH) |
| `src/lib/stats.ts`, `filters.ts` | Analytical summaries and filters |
| `src/components/` | Map (MapLibre GL), legend, filters, search, detail panel, dashboard, quality and method tabs |
| `scripts/build-data.ts` | Pipeline entry point → `public/data/` |
| `scripts/geo/` | Python helpers for the CBS geodatabase and the CEC roster |
| `tests/` | Vitest suites |

Stack: Vite, React and TypeScript; MapLibre GL for the polygon map, with an optional CARTO/OSM basemap; hand-built SVG charts; Vitest.

## Documentation

- [docs/METHODOLOGY.md](docs/METHODOLOGY.md): classification, tie rule, turnout definition, double envelopes, color function, scale bounds, statistics.
- [docs/DATA.md](docs/DATA.md): sources, provenance, joins, coverage, how to load final 2026 results.

## Caveats

- Locality turnout excludes double-envelope votes in both years, so it is lower than official national turnout.
- 2026 figures will change when the count, including double envelopes, is final.
- The political balance is computed only from votes for the two defined blocs. It is not a description of the whole electorate.
- The dashboard shows associations, not causes.
