"""Shared look and data loading for the standalone charts in docs/charts/."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import patheffects as pe

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "public" / "data" / "dataset.json"
OUT = ROOT / "docs" / "charts"

# Same cut-offs as TENDENCY in src/config/analysis.ts: balanced = within 55/45.
CUT = (-0.1, 0.1)

# Palette (validated: CVD ΔE ≥ 10.7, normal-vision ΔE ≥ 18.1, ≥ 3:1 on the surface).
BG = "#fbfaf7"
INK = "#1c1d21"
INK2 = "#4b4f58"
MUTED = "#80848d"
GRID = "#e7e5df"
BAND = "#f3f1ec"
COLOR = {"anti": "#2a6fdb", "bal": "#a8429f", "pro": "#d9483a", "gray": "#8a8a8a"}
DARK = {"anti": "#163f86", "bal": "#62215c", "pro": "#8c2219", "gray": "#3d3d3d"}
NAME = {"anti": "Opposition-leaning", "bal": "Balanced", "pro": "Netanyahu coalition-leaning", "gray": "Arab-party plurality"}
RANGE = {
    "anti": f"balance ≤ −{-CUT[0]:g}",
    "bal": f"−{-CUT[0]:g} to +{CUT[1]:g}",
    "pro": f"balance ≥ +{CUT[1]:g}",
    "gray": "an Arab party led",
}

SERIF = "Caladea"
SANS = "Inter"

HALO = [pe.Stroke(linewidth=5.2, foreground=BG), pe.Normal()]

FOOTNOTE = (
    "Coalition: Likud, Religious Zionism, Shas, United Torah Judaism.  Opposition: Yesh Atid, National Unity, Yisrael Beiteinu, Labor, Meretz.  "
    "Balance = (coalition − opposition) ÷ (coalition + opposition) votes, 2022.\n"
    "Arab-party plurality: Ra'am, Hadash–Ta'al or Balad was the single most-voted list in 2022.  "
    "Turnout = votes ÷ eligible voters at the locality's ballot boxes (double envelopes excluded).\n"
    "Sources: Central Elections Committee 2022 final results; 2026 22:00 election-day turnout report by ballot box (preliminary, not final)."
)


def apply_rc():
    plt.rcParams.update(
        {
            "font.family": SANS,
            "font.size": 10.5,
            "text.color": INK,
            "axes.edgecolor": GRID,
            "axes.labelcolor": INK2,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "svg.fonttype": "none",
        }
    )


def group(c):
    if c["isArabPlurality"]:
        return "gray"
    return "anti" if c["balance"] <= CUT[0] else "pro" if c["balance"] >= CUT[1] else "bal"


def load_rows():
    """One row per analysed locality: code, name, group, balance, change (pp), eligible (2022)."""
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    return [
        {
            "code": str(l["code"]),
            "name": l["name_en"] or l["name_he"],
            "group": group(l["classification"]),
            "balance": l["classification"]["balance"],
            "change": l["turnoutChangePp"],
            "eligible": l["y2022"]["eligible"],
        }
        for l in data["localities"]
        if l["analysed"]
    ]


def signed(v, digits=0):
    """'+5', '−10', '0' with a true minus sign."""
    if round(v, digits) == 0:
        return f"{0:.{digits}f}"
    return f"+{v:.{digits}f}" if v > 0 else f"−{-v:.{digits}f}"


def save(fig, stem):
    OUT.mkdir(parents=True, exist_ok=True)
    for ext in ("png", "svg", "pdf"):
        fig.savefig(OUT / f"{stem}.{ext}", facecolor=BG)
