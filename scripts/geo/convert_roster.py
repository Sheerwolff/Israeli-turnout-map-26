#!/usr/bin/env python3
"""Convert the CEC Knesset-26 polling-station roster (xlsx) to CSV.

The roster lists every ballot box the CEC opened for the 2026 election with its
number of registered voters ("בוחרי כנסת"). The data pipeline uses it to measure
how much of each locality's electorate is covered by a partial results file.

Usage:
    python scripts/geo/convert_roster.py data/raw/2026/stations-roster.xlsx data/raw/2026/stations-roster.csv

Requires: pandas, openpyxl.
"""

import sys

import pandas as pd

COLUMNS = {
    "סמל ישוב בחירות": "locality_code",
    "שם ישוב בחירות": "locality_name",
    "סמל קלפי": "ballot_box",
    "בוחרי כנסת": "eligible",
}


def main(src, dst):
    df = pd.read_excel(src)
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"roster is missing columns: {missing}")
    df = df[list(COLUMNS)].rename(columns=COLUMNS)
    df = df[df["locality_code"].notna()]  # drops the trailing footer row
    df["locality_code"] = df["locality_code"].astype(int)
    df["eligible"] = df["eligible"].astype(int)
    df["locality_name"] = df["locality_name"].astype(str).str.strip()
    df.to_csv(dst, index=False, encoding="utf-8")
    print(f"wrote {len(df)} ballot boxes, {df['eligible'].sum()} eligible voters to {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
