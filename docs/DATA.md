# Data sources and pipeline

All inputs are listed, with origin notes, in `config/sources.json`. Each build records every file's SHA-256 in `public/data/dataset.json` (`meta.sources`), and the app shows them in the Data quality tab.

| File | What | Origin | Status |
|---|---|---|---|
| `data/raw/2022/expc.csv` | Knesset 25 results by locality | CEC (`expc.csv`), supplied by the project owner | Final. Matches the official national totals (6,788,804 eligible; 4,794,593 votes; 4,764,742 valid). |
| `data/raw/2022/expb.csv` | Knesset 25 results by ballot box | CEC (`expb.csv`), supplied by the project owner | Final. Used only as a cross-check: it adds up exactly to `expc.csv` for every locality. |
| `data/raw/2026/turnout-feed-2200.csv` | Election-day turnout by ballot box, 22:00 report (Windows-1255) | CEC, supplied by the project owner | **Primary 2026 source.** 11,996 boxes in 1,221 localities. Each box's last report of the day; 2,486 boxes last updated before 21:30 are flagged as stale. The `99999` "national sample" row (77.7%) is an estimate and is not used for any locality. |
| `data/raw/2026/expb.csv` | Knesset 26 results by ballot box | CEC results feed, mirrored by [harelc/elections-vote-transfer](https://github.com/harelc/elections-vote-transfer) (`ballot26.csv`, bot commit 8dd817b, 2026-10-28 12:40 UTC) | **Partial count** (11,168 of 12,018 boxes). Fallback only, for the 20 boxes missing from the turnout report. Not re-downloaded from the CEC, which is unreachable from the build environment. |
| `data/raw/2026/stations-roster.xlsx` → `.csv` | All 2026 ballot boxes with registered voters | CEC polling-station list, mirrored by the same repository | 12,018 boxes, 7,331,981 eligible voters. Used only to measure coverage. |
| `data/geo/localities.geojson` | One polygon per locality code | CBS statistical areas 2011 / demography 2019 (`statisticalareas_demography2019.gdb`), dissolved by `SEMEL_YISHUV` | Polygons are the CBS statistical-area extents of each locality, not municipal jurisdictions. Simplified to 20 m. |

No polling, projection, exit poll or media figure is used anywhere.

## Joins

Every dataset is joined on the official **CBS/CEC locality code** (`סמל ישוב` / `SEMEL_YISHUV`), never on names. Names, in Hebrew from the CEC and CBS and in English from the CBS, are used only for display and search. Name differences between the 2022 and 2026 CEC files are reported, not used. 2026 ballot boxes are matched across the count, the feed and the roster on `(locality code, box number)`, with the box number normalised so that `1`, `1.0` and `1.00` match.

## Coverage (build of 28 Oct 2026)

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
| 2026 boxes: turnout report / of which stale / count fallback / missing | 11,996 / 2,486 / 20 / 2 |

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
2. In `config/sources.json`, update `results2026.path`, its `origin` and `notes`, set `primary2026` to `"count"` and `mode` to `"official_final"`. You may remove `feed2026` once every box is counted.
3. Run `npm run build:data` and `npm test`.
