# Data sources and pipeline

All inputs are listed, with origin notes, in `config/sources.json`. Each build records every file's SHA-256 in `public/data/dataset.json` (`meta.sources`), and the app shows them in the Data quality tab.

| File | What | Origin | Status |
|---|---|---|---|
| `data/raw/2022/expc.csv` | Knesset 25 results by locality | CEC (`expc.csv`), supplied by the project owner | Final. Matches the official national totals (6,788,804 eligible; 4,794,593 votes; 4,764,742 valid). |
| `data/raw/2022/expb.csv` | Knesset 25 results by ballot box | CEC (`expb.csv`), supplied by the project owner | Final. Used only as a cross-check: it adds up exactly to `expc.csv` for every locality. |
| `data/raw/2026/expc.csv` | Knesset 26 results by locality | CEC (`expc.csv`), supplied by the project owner on 31 Oct 2026 | **2026 source** for turnout and the 2026 balance. All 12,018 boxes counted; eligible voters match the roster for every locality; 5,716,673 votes incl. 451,988 double envelopes (78.0%). Not yet certified final. |
| `data/raw/2026/turnout-feed-2200.csv` | Election-day turnout by ballot box, 22:00 report (Windows-1255) | CEC, supplied by the project owner | No longer used (the 2026 source until 31 Oct). Kept for reference. |
| `data/raw/2026/expb.csv` | Knesset 26 partial count by ballot box | CEC results feed, mirrored by [harelc/elections-vote-transfer](https://github.com/harelc/elections-vote-transfer) (`ballot26.csv`, 2026-10-28 12:40 UTC) | No longer used. Kept for reference. |
| `data/raw/2026/stations-roster.xlsx` → `.csv` | All 2026 ballot boxes with registered voters | CEC polling-station list, mirrored by the same repository | 12,018 boxes, 7,331,981 eligible voters. Used only to measure coverage. |
| `data/geo/localities.geojson` | One polygon per locality code | CBS statistical areas 2011 / demography 2019 (`statisticalareas_demography2019.gdb`), dissolved by `SEMEL_YISHUV` | Polygons are the CBS statistical-area extents of each locality, not municipal jurisdictions. Simplified to 20 m. |

No polling, projection, exit poll or media figure is used anywhere.

## Joins

Every dataset is joined on the official **CBS/CEC locality code** (`סמל ישוב` / `SEMEL_YISHUV`), never on names. Names, in Hebrew from the CEC and CBS and in English from the CBS, are used only for display and search. Name differences between the 2022 and 2026 CEC files are reported, not used. 2026 ballot boxes are matched across the count, the feed and the roster on `(locality code, box number)`, with the box number normalised so that `1`, `1.0` and `1.00` match.

## Coverage (build of 31 Oct 2026)

| | Count |
|---|---|
| Locality codes in either election | 1,224 |
| …in both elections | 1,215 |
| …matched to a polygon | 1,190 |
| Analysed (classified + valid turnout change) | 1,215 (1,186 on the map) |
| Excluded | 9 (new in 2026: no 2022 results, so cannot be classified) |
| Gray (Arab-party plurality) | 126 |
| Election records without a polygon | 34 (military bases, unrecognised Bedouin tribes, Hebron, new localities). These appear in summaries and search, but not on the map. |
| Polygons without election data | 142 (48 unnamed non-residential CBS areas, plus localities with no polling station of their own). Drawn as dotted outlines. |
| 2026 coverage of the roster electorate | 100% in every locality |
| Localities with a balance change (both years) | 1,212 of 1,215 analysed |

The live numbers are in the app's Data quality tab and are printed by `npm run build:data`.

## Rebuilding

```bash
npm install
npm run build:data          # official data → public/data/dataset.json + geometry.geojson
npm run build:data:mock     # 2026 replaced by labelled synthetic turnout (mock mode)
```

The build exits non-zero if any error-level check fails, such as duplicate codes or boxes, arithmetic inconsistencies, or unclassified party letters.

To regenerate the polygons or the roster CSV (Python ≥ 3.10):

```bash
pip install -r scripts/geo/requirements.txt
python scripts/geo/build_geometry.py path/to/statisticalareas_demography2019.gdb
python scripts/geo/convert_roster.py data/raw/2026/stations-roster.xlsx data/raw/2026/stations-roster.csv
```

### Updating to final 2026 results

1. Put the final CEC file in `data/raw/2026/`, either `expb.csv` (by box) or `expc.csv` (by locality; both formats are read automatically).
2. In `config/sources.json`, update `results2026.path`, its `origin` and `notes`, and set `mode` to `"official_final"`. If new lists appear, add their letters to `config/parties-2026.json` (the build fails until every letter is mapped).
3. Run `npm run build:data` and `npm test`.
