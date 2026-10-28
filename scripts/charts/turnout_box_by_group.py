"""Standalone chart: distribution of 2022→2026 turnout change in each 2022 political group.

Diamond = mean, whiskers = its 95% confidence interval (mean ± t × SD/√n), faint box = middle half
of localities with its median line, dots = every locality. Writes docs/charts/turnout-box-by-group.{png,svg,pdf}.

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


Z975 = 1.959963984540054


def t975(df):
    """Two-sided 95% Student-t critical value (Cornish–Fisher expansion; error < 1e-4 for df ≥ 30)."""
    z = Z975
    return z + (z**3 + z) / (4 * df) + (5 * z**5 + 16 * z**3 + 3 * z) / (96 * df**2) + (3 * z**7 + 19 * z**5 + 17 * z**3 - 15 * z) / (384 * df**3)


def summary(x):
    q1, med, q3 = np.quantile(x, [0.25, 0.5, 0.75])  # linear interpolation, as in src/lib/stats.ts
    mean = x.mean()
    half = t975(len(x) - 1) * x.std(ddof=1) / np.sqrt(len(x))
    return q1, med, q3, mean, mean - half, mean + half


fig = plt.figure(figsize=(12, 7.6), dpi=200, facecolor=BG)
ax = fig.add_axes([0.265, 0.215, 0.56, 0.62], facecolor=BG)
for s in ax.spines.values():
    s.set_visible(False)

# Zoomed so the confidence intervals (1–3 pp wide) are legible; localities outside are counted at the row edges.
X0, X1 = -10, 35
ax.set_xlim(X0 - 1.5, X1 + 1.5)
ax.set_ylim(len(ORDER) - 0.45, -0.55)
for x in range(X0, X1 + 1, 5):
    ax.axvline(x, color=GRID, lw=0.8, zorder=0)
ax.axvline(0, color="#b9b6ae", lw=1.2, zorder=1)
ax.set_xticks(range(X0, X1 + 1, 5))
ax.set_xticklabels([signed(v) for v in range(X0, X1 + 1, 5)])
ax.set_yticks([])
ax.tick_params(length=0, labelsize=9.5)
ax.set_xlabel("Change in turnout, 2022 → 2026 (percentage points)", fontsize=9.8, labelpad=10)

rng = np.random.default_rng(11)
# Nir Oz, Be'eri, Kfar Aza, Holit: the sharpest drops, named in the out-of-range note.
NEGEV_CODES = {"69", "399", "845", "1239"}
for i, g in enumerate(ORDER):
    x = vals[g]
    q1, med, q3, mean, lo, hi = summary(x)
    # Every locality, jittered vertically inside its row.
    jit = i + rng.uniform(-0.27, 0.27, len(x))
    shown = (x >= X0) & (x <= X1)
    ax.scatter(x[shown], jit[shown], s=11, color=COLOR[g], alpha=0.38, linewidths=0, zorder=2)
    below, above = int((x < X0).sum()), int((x > X1).sum())
    if below:
        kib = [r for r in rows if r["code"] in NEGEV_CODES and r["group"] == g and r["change"] < X0]
        detail = ", incl. Nir Oz, Be'eri, Kfar Aza, Holit (western Negev kibbutzim)" if len(kib) == len(NEGEV_CODES) else ""
        ax.text(X0 - 1.2, i + 0.36, f"← {below} below {signed(X0)}{detail}", fontsize=7.8, color=MUTED, ha="left", va="center")
    if above:
        ax.text(X1 + 1.2, i + 0.36, f"{above} above {signed(X1)} →", fontsize=7.8, color=MUTED, ha="right", va="center")
    # Faint box: middle half of localities, with the median.
    ax.add_patch(
        FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, boxstyle="round,pad=0,rounding_size=0.6", mutation_aspect=0.04,
                       facecolor=COLOR[g], alpha=0.22, edgecolor="none", zorder=4)
    )
    ax.add_patch(
        FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, boxstyle="round,pad=0,rounding_size=0.6", mutation_aspect=0.04,
                       facecolor="none", edgecolor=DARK[g], lw=0.9, alpha=0.6, zorder=5)
    )
    ax.plot([med, med], [i - 0.19, i + 0.19], color=DARK[g], lw=1.2, alpha=0.7, zorder=5, solid_capstyle="butt")
    # Mean with its 95% confidence interval.
    ax.plot([lo, hi], [i, i], color=INK, lw=2.0, zorder=7, solid_capstyle="butt", path_effects=HALO)
    for w in (lo, hi):
        ax.plot([w, w], [i - 0.11, i + 0.11], color=INK, lw=2.0, zorder=7, solid_capstyle="butt", path_effects=HALO)
    ax.scatter([mean], [i], marker="D", s=52, color=COLOR[g], edgecolors=INK, linewidths=1.4, zorder=8)

    # Left labels.
    yfig = ax.transData.transform((0, i))[1] / fig.bbox.height
    fig.text(0.075, yfig + 0.016, NAME[g], fontsize=11, fontweight="semibold", color=DARK[g], va="center")
    fig.text(0.075, yfig - 0.014, f"{RANGE[g]}  ·  {len(x):,} localities", fontsize=8.6, color=MUTED, va="center")
    # Right labels.
    fig.text(0.845, yfig + 0.016, f"mean {signed(mean, 1)} pp", fontsize=10.5, color=INK, va="center")
    fig.text(0.845, yfig - 0.014, f"95% CI {signed(lo, 1)} to {signed(hi, 1)}", fontsize=8.6, color=MUTED, va="center")

# Row separators.
for i in range(1, len(ORDER)):
    ax.axhline(i - 0.5, color=GRID, lw=0.8, zorder=0)

# Key.
ky = 0.118
key = fig.add_axes([0.265, ky - 0.014, 0.085, 0.028], facecolor=BG)
key.set_axis_off()
key.set_xlim(0, 10)
key.set_ylim(-1, 1)
key.add_patch(FancyBboxPatch((0.6, -0.8), 8.8, 1.6, boxstyle="round,pad=0,rounding_size=0.2", mutation_aspect=0.4, facecolor="#e6e3dc", edgecolor="#a9a59c", lw=0.9))
key.plot([3.6, 3.6], [-0.8, 0.8], color="#8a867e", lw=1.1)
key.plot([4.0, 6.6], [0, 0], color=INK, lw=2.0, solid_capstyle="butt")
for w in (4.0, 6.6):
    key.plot([w, w], [-0.5, 0.5], color=INK, lw=2.0, solid_capstyle="butt")
key.scatter([5.3], [0], marker="D", s=30, color="#bdb9b1", edgecolors=INK, linewidths=1.2, zorder=3)
fig.text(0.36, ky, "Diamond: mean  ·  whiskers: 95% confidence interval of the mean  ·  box: middle half of localities, thin line: median",
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
print({g: (len(vals[g]), [round(float(v), 2) for v in summary(vals[g])]) for g in ORDER})
