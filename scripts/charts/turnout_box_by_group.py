"""Standalone chart: distribution of 2022→2026 turnout change in each 2022 political group.

Box = middle half of localities, line = median, whiskers = Tukey (1.5 × IQR, the same rule as the
app's dashboard), dots = every locality. Writes docs/charts/turnout-box-by-group.{png,svg,pdf}.

    python scripts/charts/turnout_box_by_group.py
"""

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch

from style import BG, COLOR, DARK, FOOTNOTE, GRID, HALO, INK, INK2, MUTED, NAME, RANGE, SERIF, apply_rc, load_rows, save, signed

apply_rc()
rows = load_rows()
ORDER = ["anti", "bal", "pro", "gray"]
vals = {g: np.array([r["change"] for r in rows if r["group"] == g]) for g in ORDER}


def tukey(x):
    q1, med, q3 = np.quantile(x, [0.25, 0.5, 0.75])  # linear interpolation, as in src/lib/stats.ts
    lo, hi = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
    inside = x[(x >= lo) & (x <= hi)]
    return q1, med, q3, inside.min(), inside.max()


fig = plt.figure(figsize=(12, 7.6), dpi=200, facecolor=BG)
ax = fig.add_axes([0.265, 0.215, 0.56, 0.62], facecolor=BG)
for s in ax.spines.values():
    s.set_visible(False)

X0, X1 = -52, 60
ax.set_xlim(X0, X1)
ax.set_ylim(len(ORDER) - 0.45, -0.55)
for x in range(-50, 61, 10):
    ax.axvline(x, color=GRID, lw=0.8, zorder=0)
ax.axvline(0, color="#b9b6ae", lw=1.2, zorder=1)
ax.set_xticks(range(-50, 61, 10))
ax.set_xticklabels([signed(v) for v in range(-50, 61, 10)])
ax.set_yticks([])
ax.tick_params(length=0, labelsize=9.5)
ax.set_xlabel("Change in turnout, 2022 → 2026 (percentage points)", fontsize=9.8, labelpad=10)

rng = np.random.default_rng(11)
for i, g in enumerate(ORDER):
    x = vals[g]
    q1, med, q3, wlo, whi = tukey(x)
    # Every locality, jittered vertically inside its row.
    ax.scatter(x, i + rng.uniform(-0.27, 0.27, len(x)), s=9, color=COLOR[g], alpha=0.38, linewidths=0, zorder=2)
    # Whiskers and caps.
    ax.plot([wlo, q1], [i, i], color=DARK[g], lw=1.3, zorder=3, solid_capstyle="butt")
    ax.plot([q3, whi], [i, i], color=DARK[g], lw=1.3, zorder=3, solid_capstyle="butt")
    for w in (wlo, whi):
        ax.plot([w, w], [i - 0.09, i + 0.09], color=DARK[g], lw=1.3, zorder=3)
    # Box.
    ax.add_patch(
        FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, boxstyle="round,pad=0,rounding_size=0.6", mutation_aspect=0.04,
                       facecolor=COLOR[g], alpha=0.32, edgecolor="none", zorder=4)
    )
    ax.add_patch(
        FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, boxstyle="round,pad=0,rounding_size=0.6", mutation_aspect=0.04,
                       facecolor="none", edgecolor=DARK[g], lw=1.3, zorder=5)
    )
    ax.plot([med, med], [i - 0.19, i + 0.19], color=DARK[g], lw=3, zorder=6, path_effects=HALO, solid_capstyle="butt")

    # Left labels.
    yfig = ax.transData.transform((0, i))[1] / fig.bbox.height
    fig.text(0.075, yfig + 0.016, NAME[g], fontsize=11, fontweight="semibold", color=DARK[g], va="center")
    fig.text(0.075, yfig - 0.014, f"{RANGE[g]}  ·  {len(x):,} localities", fontsize=8.6, color=MUTED, va="center")
    # Right labels.
    fig.text(0.845, yfig + 0.016, f"median {signed(med, 1)} pp", fontsize=10.5, color=INK, va="center")
    fig.text(0.845, yfig - 0.014, f"middle half {signed(q1, 1)} to {signed(q3, 1)} pp", fontsize=8.6, color=MUTED, va="center")

# Row separators.
for i in range(1, len(ORDER)):
    ax.axhline(i - 0.5, color=GRID, lw=0.8, zorder=0)

# Callout for the western Negev kibbutzim, the sharpest drops.
negev = {"69", "399", "845", "1239"}
pts = [r["change"] for r in rows if r["code"] in negev]
if pts:
    ax.text(min(pts) - 1.5, 0.4, "Nir Oz, Be'eri, Kfar Aza, Holit\n(western Negev kibbutzim)", fontsize=8, color=INK2, ha="left", va="center", linespacing=1.25, zorder=7)

# Key for reading a box.
ky = 0.118
key = fig.add_axes([0.265, ky - 0.014, 0.085, 0.028], facecolor=BG)
key.set_axis_off()
key.set_xlim(0, 10)
key.set_ylim(-1, 1)
key.plot([0.2, 2.6], [0, 0], color=INK2, lw=1.1)
key.plot([7.0, 9.8], [0, 0], color=INK2, lw=1.1)
for w in (0.2, 9.8):
    key.plot([w, w], [-0.45, 0.45], color=INK2, lw=1.1)
key.add_patch(FancyBboxPatch((2.6, -0.8), 4.4, 1.6, boxstyle="round,pad=0,rounding_size=0.2", mutation_aspect=0.4, facecolor="#dedbd4", edgecolor=INK2, lw=1.1))
key.plot([4.4, 4.4], [-0.8, 0.8], color=INK, lw=2.4)
fig.text(0.36, ky, "Box: middle half of localities  ·  thick line: median  ·  whiskers: furthest locality within 1.5× the box width  ·  dots: every locality",
         fontsize=8.4, color=MUTED, va="center")

fig.text(0.075, 0.935, "How turnout changed in each political group", fontsize=27, fontfamily=SERIF, fontweight="bold", color=INK, va="bottom")
fig.text(
    0.075,
    0.922,
    "Change in turnout from the 2022 to the 2026 Knesset election in Israeli localities, grouped by how they voted in 2022.\n"
    "Each locality counts once, whatever its size.",
    fontsize=10.6,
    color=INK2,
    va="top",
    linespacing=1.45,
)
fig.text(0.075, 0.016, FOOTNOTE + f"  n = {len(rows):,} localities.", fontsize=7.9, color=MUTED, va="bottom", linespacing=1.55)

save(fig, "turnout-box-by-group")
print({g: (len(vals[g]), [round(v, 2) for v in tukey(vals[g])]) for g in ORDER})
