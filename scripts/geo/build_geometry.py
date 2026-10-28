#!/usr/bin/env python3
"""Build locality polygons from the CBS statistical-areas layer.

Input:  CBS FileGDB "statisticalareas_demography2019.gdb" (Israel Central Bureau
        of Statistics, 2011 statistical-area boundaries with 2019 demography).
        Download it from https://www.cbs.gov.il/he/Pages/geo-layers.aspx
Output: data/geo/localities.geojson, one feature per CBS locality code
        (SEMEL_YISHUV), WGS84, simplified.

The statistical areas of each locality are dissolved into a single
(multi)polygon keyed by the official CBS locality code, which is the same code
the Central Elections Committee uses in its "סמל ישוב" column. No name matching
is done here.

Usage:
    python scripts/geo/build_geometry.py path/to/statisticalareas_demography2019.gdb

Requires: geopandas, pyogrio, shapely, pyproj (see scripts/geo/requirements.txt).
"""

import json
import sys
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "geo" / "localities.geojson"
# Douglas-Peucker tolerance in metres (source CRS is Israel TM Grid, EPSG:2039).
SIMPLIFY_M = 20
COORD_DECIMALS = 5  # ~1 m at Israel's latitude


def round_coords(obj):
    if isinstance(obj, float):
        return round(obj, COORD_DECIMALS)
    if isinstance(obj, (list, tuple)):
        return [round_coords(x) for x in obj]
    return obj


def text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def main(gdb_path):
    g = gpd.read_file(gdb_path)
    if g.crs is None or g.crs.to_epsg() != 2039:
        raise SystemExit(f"unexpected CRS {g.crs}; expected EPSG:2039")
    g["SEMEL_YISHUV"] = g["SEMEL_YISHUV"].astype(int)
    g["geometry"] = g.geometry.buffer(0)  # repair self-intersections before dissolving

    attrs = (
        g.sort_values("STAT11")
        .groupby("SEMEL_YISHUV")
        .agg(
            name_he=("SHEM_YISHUV", "first"),
            name_en=("SHEM_YISHUV_ENGLISH", "first"),
            population_group=("Religion_yishuv_Txt", "first"),
            population_2019=("Pop_Total", "sum"),
            stat_areas=("STAT11", "count"),
        )
    )
    dissolved = g[["SEMEL_YISHUV", "geometry"]].dissolve(by="SEMEL_YISHUV")
    dissolved["geometry"] = dissolved.geometry.simplify(SIMPLIFY_M, preserve_topology=True)
    dissolved = dissolved.join(attrs).to_crs(4326)

    features = []
    for code, row in dissolved.sort_index().iterrows():
        geom = row.geometry
        valid = geom is not None and not geom.is_empty
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "code": int(code),
                    "name_he": text(row.name_he),
                    "name_en": text(row.name_en).title() if text(row.name_en) else None,
                    "population_group": text(row.population_group),
                    "population_2019": None if row.population_2019 != row.population_2019 else int(row.population_2019),
                    "stat_areas": int(row.stat_areas),
                },
                "geometry": round_coords(geom.__geo_interface__) if valid else None,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"wrote {len(features)} localities to {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
