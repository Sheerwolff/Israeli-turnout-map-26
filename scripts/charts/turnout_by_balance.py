"""Standalone chart: 2022 political balance vs 2022→2026 turnout change, one dot per locality.

Reads the app's processed dataset and writes PNG, SVG and PDF to docs/charts/.

    python scripts/charts/turnout_by_balance.py

Requires matplotlib and numpy; uses the Inter and Caladea fonts when installed.
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.gridspec import GridSpec
from matplotlib import patheffects as pe
from matplotlib.transforms import blended_transform_factory

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "data" / "dataset.json"
OUT = ROOT / "docs" / "charts"
CUT = (-0.2, 0.2)  # same cut-offs as src/config/analysis.ts

# ---- Palette (validated: CVD ΔE ≥ 10.7, normal-vision ΔE ≥ 18.1, ≥ 3:1 on the surface) ----
BG = "#fbfaf7"
INK = "#1c1d21"
INK2 = "#4b4f58"
MUTED = "#80848d"
GRID = "#e7e5df"
BAND = "#f3f1ec"
C = {"anti": "#2a6fdb", "bal": "#a8429f", "pro": "#d9483a", "gray": "#8a8a8a"}

SERIF = "Caladea"
SANS = "Inter"
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


rows = [
    {
        "code": str(l["code"]),
        "group": group(l["classification"]),
        "balance": l["classification"]["balance"],
        "change": l["turnoutChangePp"],
        "eligible": l["y2022"]["eligible"],
    }
    for l in json.loads(SRC.read_text(encoding="utf-8"))["localities"]
    if l["analysed"]
]

bloc = [r for r in rows if r["group"] != "gray"]
gray = [r for r in rows if r["group"] == "gray"]
med = {g: float(np.median([r["change"] for r in rows if r["group"] == g])) for g in C}
cnt = {g: sum(1 for r in rows if r["group"] == g) for g in C}

size = lambda e: np.clip(np.sqrt(e) * 0.55, 6, 260)  # dot area ∝ eligible voters

fig = plt.figure(figsize=(12, 9.6), dpi=200, facecolor=BG)
gs = GridSpec(1, 2, width_ratios=[8.2, 1.25], wspace=0.04, left=0.075, right=0.975, top=0.79, bottom=0.175)
ax = fig.add_subplot(gs[0])
axg = fig.add_subplot(gs[1], sharey=ax)
Y0, Y1 = -52, 60

for a in (ax, axg):
    a.set_facecolor(BG)
    for s in a.spines.values():
        s.set_visible(False)
    a.set_ylim(Y0, Y1)
    a.tick_params(length=0, labelsize=9.5)
    for y in range(-50, 61, 10):
        a.axhline(y, color=GRID, lw=0.8, zorder=0)
    a.axhline(0, color="#b9b6ae", lw=1.2, zorder=1)

# ---- Main panel: blue / purple / red localities ----
ax.set_xlim(-1.02, 1.02)
ax.axvspan(-0.2, 0.2, color=BAND, zorder=0, lw=0)
order = sorted(bloc, key=lambda r: -r["eligible"])  # big dots underneath
ax.scatter(
    [r["balance"] for r in order],
    [r["change"] for r in order],
    s=[size(r["eligible"]) for r in order],
    c=[C[r["group"]] for r in order],
    alpha=0.78,
    edgecolors=BG,
    linewidths=0.6,
    zorder=3,
)

# Group medians across each band.
DARK = {"anti": "#163f86", "bal": "#62215c", "pro": "#8c2219", "gray": "#3d3d3d"}
halo = [pe.Stroke(linewidth=5.2, foreground=BG), pe.Normal()]
for g, (x0, x1) in {"anti": (-1, -0.2), "bal": (-0.2, 0.2), "pro": (0.2, 1)}.items():
    ax.plot([x0 + 0.02, x1 - 0.02], [med[g]] * 2, color=DARK[g], lw=2.4, solid_capstyle="round", zorder=6, path_effects=halo)

band_labels = {
    "anti": (-0.6, "Opposition-leaning", "balance ≤ −0.2"),
    "bal": (0.0, "Balanced", "−0.2 to +0.2"),
    "pro": (0.6, "Netanyahu coalition-leaning", "balance ≥ +0.2"),
}
tr = blended_transform_factory(ax.transData, ax.transAxes)
for g, (x, name, rng) in band_labels.items():
    ax.text(x, 1.085, name, transform=tr, ha="center", va="bottom", fontsize=11, fontweight="semibold", color=DARK[g])
    ax.text(x, 1.05, f"median {med[g]:+.1f} pp", transform=tr, ha="center", va="bottom", fontsize=10, color=INK)
    ax.text(x, 1.015, f"{rng}  ·  {cnt[g]:,} localities", transform=tr, ha="center", va="bottom", fontsize=8.6, color=MUTED)

ax.set_xticks([-1, -0.5, 0, 0.5, 1])
ax.set_xticklabels(["−1", "−0.5", "0", "+0.5", "+1"])
ax.text(-1.0, -0.048, "← all to the opposition", transform=tr, fontsize=8.6, color=MUTED, ha="left", va="top")
ax.text(1.0, -0.048, "all to the coalition →", transform=tr, fontsize=8.6, color=MUTED, ha="right", va="top")
ax.set_yticks(range(-50, 61, 10))
ax.set_yticklabels([(f"+{v}" if v > 0 else f"−{-v}") if v else "0" for v in range(-50, 61, 10)])
ax.set_xlabel(
    "2022 political balance  =  (coalition − opposition) ÷ (coalition + opposition) votes",
    fontsize=9.8,
    labelpad=8,
)
ax.set_ylabel("Change in turnout, 2022 → 2026 (percentage points)", fontsize=9.8, labelpad=8)


# ---- Annotations ----
NAMES = {
    "5000": "Tel Aviv–Yafo",
    "3000": "Jerusalem",
    "6100": "Bnei Brak",
    "4000": "Haifa",
    "69": "Nir Oz",
    "399": "Be'eri",
    "845": "Kfar Aza",
    "2610": "Beit Shemesh",
}
OFFS = {"5000": (-46, 30), "3000": (34, 30), "6100": (-8, -34), "4000": (-30, -34), "69": (34, -6), "399": (34, 4), "845": (-60, 10), "2610": (-56, -30)}
by_code = {r["code"]: r for r in rows}
for code, label in NAMES.items():
    r = by_code.get(code)
    if not r:
        continue
    dx, dy = OFFS[code]
    ax.annotate(
        f"{label}  {r['change']:+.1f}",
        (r["balance"], r["change"]),
        xytext=(dx, dy),
        textcoords="offset points",
        fontsize=8.6,
        color=INK2,
        ha="center",
        arrowprops=dict(arrowstyle="-", color="#9a9ea6", lw=0.7, shrinkA=0, shrinkB=3),
        bbox=dict(boxstyle="round,pad=0.25", fc=BG, ec="none", alpha=0.9),
        zorder=7,
    )

# ---- Right panel: Arab-party plurality localities ----
rng = np.random.default_rng(7)
axg.set_xlim(0, 1)
axg.axvspan(0, 1, color=BAND, zorder=0, lw=0)
gx = 0.5 + rng.uniform(-0.36, 0.36, len(gray))
axg.scatter(gx, [r["change"] for r in gray], s=[size(r["eligible"]) for r in gray], c=C["gray"], alpha=0.8, edgecolors=BG, linewidths=0.6, zorder=3)
axg.plot([0.06, 0.94], [med["gray"]] * 2, color=DARK["gray"], lw=2.4, solid_capstyle="round", zorder=6, path_effects=halo)
trg = blended_transform_factory(axg.transData, axg.transAxes)
axg.text(0.5, 1.085, "Arab-party plurality", transform=trg, ha="center", va="bottom", fontsize=11, fontweight="semibold", color=DARK["gray"])
axg.text(0.5, 1.05, f"median {med['gray']:+.1f} pp", transform=trg, ha="center", va="bottom", fontsize=10, color=INK)
axg.text(0.5, 1.015, f"{cnt['gray']} localities", transform=trg, ha="center", va="bottom", fontsize=8.6, color=MUTED)
axg.set_xticks([])
plt.setp(axg.get_yticklabels(), visible=False)

# ---- Size key (empty lower-right corner of the main panel) ----
ax.text(0.43, -36.5, "Dot area = eligible voters, 2022", fontsize=8.6, color=MUTED, ha="left", va="center")
for i, (e, lab) in enumerate([(1_000, "1,000"), (10_000, "10,000"), (100_000, "100,000")]):
    x = 0.47 + i * 0.2
    ax.scatter([x], [-43], s=size(e), c="#c9c6bf", edgecolors=BG, linewidths=0.6, zorder=3)
    ax.text(x + 0.045, -43, lab, fontsize=8.4, color=MUTED, va="center", ha="left")

# ---- Titles and notes ----
fig.text(0.075, 0.948, "Turnout change by 2022 political balance", fontsize=27, fontfamily=SERIF, fontweight="bold", color=INK, va="bottom")
fig.text(
    0.075,
    0.938,
    "Each dot is one Israeli locality: its 2022 vote balance between the Netanyahu coalition and the opposition (left–right),\n"
    "and how much its turnout changed from the 2022 to the 2026 Knesset election (up–down). Bars show each group's median.",
    fontsize=10.6,
    color=INK2,
    va="top",
    linespacing=1.45,
)
fig.text(
    0.075,
    0.014,
    "Coalition: Likud, Religious Zionism, Shas, United Torah Judaism.  Opposition: Yesh Atid, National Unity, Yisrael Beiteinu, Labor, Meretz.  "
    "Arab-party and other votes are excluded from the balance.\n"
    "Gray: an Arab party (Ra'am, Hadash–Ta'al or Balad) was the single most-voted list in 2022; horizontal position in that panel carries no meaning.  "
    "Turnout = votes ÷ eligible voters at the locality's ballot boxes\n"
    "(double envelopes excluded).  Sources: Central Elections Committee 2022 final results; 2026 22:00 election-day turnout report by ballot box (preliminary, not final).  "
    f"n = {len(rows):,} localities.",
    fontsize=7.9,
    color=MUTED,
    va="bottom",
    linespacing=1.55,
)

OUT.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT / "turnout-by-balance.png", facecolor=BG)
fig.savefig(OUT / "turnout-by-balance.svg", facecolor=BG)
fig.savefig(OUT / "turnout-by-balance.pdf", facecolor=BG)
print("medians", med, "counts", cnt)
