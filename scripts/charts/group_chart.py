"""One row per 2022 political group: every locality as a dot, the middle half as a faint box with its
median, and the mean as a diamond with its 95% confidence interval. Shared by the group charts."""

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch

from style import BG, COLOR, DARK, GRID, HALO, INK, INK2, MUTED, NAME, RANGE, SERIF, apply_rc, save, signed, summary

ORDER = ["anti", "bal", "pro", "gray"]


def draw_group_chart(
    vals,
    *,
    x_range,
    ticks,
    tick_label,
    value_label,
    xlabel,
    title,
    subtitle,
    footnote,
    stem,
    below_note=lambda g: "",
    row_note=lambda g: "",
    reference=None,
):
    """vals: {group: np.array}. x_range: (lo, hi) shown; values outside are counted at the row edges.
    tick_label / value_label: number → text. reference: optional (x, label) drawn as a dashed line."""
    apply_rc()
    X0, X1 = x_range
    span = X1 - X0
    pad = span * 0.033
    fig = plt.figure(figsize=(12, 7.6), dpi=200, facecolor=BG)
    # Each footnote line beyond three pushes the plot and key up by one line.
    lift = 0.022 * max(0, footnote.count("\n") - 2)
    ax = fig.add_axes([0.265, 0.215 + lift, 0.56, 0.62 - lift], facecolor=BG)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xlim(X0 - pad, X1 + pad)
    ax.set_ylim(len(ORDER) - 0.45, -0.55)
    for x in ticks:
        ax.axvline(x, color=GRID, lw=0.8, zorder=0)
    ax.axvline(0, color="#b9b6ae", lw=1.2, zorder=1)
    ax.set_xticks(ticks)
    ax.set_xticklabels([tick_label(v) for v in ticks])
    ax.set_yticks([])
    ax.tick_params(length=0, labelsize=9.5)
    ax.set_xlabel(xlabel, fontsize=9.8, labelpad=10)

    radius = span * 0.013  # box corner rounding in data units
    rng = np.random.default_rng(11)
    for i, g in enumerate(ORDER):
        x = vals[g]
        q1, med, q3, mean, lo, hi = summary(x)
        jit = i + rng.uniform(-0.27, 0.27, len(x))
        shown = (x >= X0) & (x <= X1)
        ax.scatter(x[shown], jit[shown], s=11, color=COLOR[g], alpha=0.38, linewidths=0, zorder=2)
        below, above = int((x < X0).sum()), int((x > X1).sum())
        if below:
            ax.text(X0 - pad * 0.8, i + 0.36, f"← {below} below {tick_label(X0)}{below_note(g)}", fontsize=7.8, color=MUTED, ha="left", va="center")
        if above:
            ax.text(X1 + pad * 0.8, i + 0.36, f"{above} above {tick_label(X1)} →", fontsize=7.8, color=MUTED, ha="right", va="center")

        box = dict(boxstyle=f"round,pad=0,rounding_size={radius}", mutation_aspect=0.025 / radius)
        ax.add_patch(FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, facecolor=COLOR[g], alpha=0.22, edgecolor="none", zorder=4, **box))
        ax.add_patch(FancyBboxPatch((q1, i - 0.19), q3 - q1, 0.38, facecolor="none", edgecolor=DARK[g], lw=0.9, alpha=0.6, zorder=5, **box))
        ax.plot([med, med], [i - 0.19, i + 0.19], color=DARK[g], lw=1.2, alpha=0.7, zorder=5, solid_capstyle="butt")
        ax.plot([lo, hi], [i, i], color=INK, lw=2.0, zorder=7, solid_capstyle="butt", path_effects=HALO)
        for w in (lo, hi):
            ax.plot([w, w], [i - 0.11, i + 0.11], color=INK, lw=2.0, zorder=7, solid_capstyle="butt", path_effects=HALO)
        ax.scatter([mean], [i], marker="D", s=52, color=COLOR[g], edgecolors=INK, linewidths=1.4, zorder=8)

        yfig = ax.transData.transform((0, i))[1] / fig.bbox.height
        fig.text(0.075, yfig + 0.016, NAME[g], fontsize=11, fontweight="semibold", color=DARK[g], va="center")
        fig.text(0.075, yfig - 0.014, f"{RANGE[g]}  ·  {len(x):,} localities", fontsize=8.6, color=MUTED, va="center")
        note = row_note(g)
        if note:
            fig.text(0.075, yfig - 0.036, note, fontsize=8, color=MUTED, va="top", style="italic", linespacing=1.3)
        fig.text(0.845, yfig + 0.016, f"mean {value_label(mean)}", fontsize=10.5, color=INK, va="center")
        fig.text(0.845, yfig - 0.014, f"95% CI {value_label(lo, unit=False)} to {value_label(hi, unit=False)}", fontsize=8.6, color=MUTED, va="center")

    for i in range(1, len(ORDER)):
        ax.axhline(i - 0.5, color=GRID, lw=0.8, zorder=0)

    if reference is not None:
        rx, rlabel = reference
        ax.axvline(rx, color=INK2, lw=1.0, ls=(0, (4, 3)), zorder=6)
        ax.text(rx, -0.53, rlabel, fontsize=8.2, color=INK2, ha="center", va="bottom",
                bbox=dict(boxstyle="round,pad=0.25", fc=BG, ec="none"), zorder=9)

    # Key.
    ky = 0.118 + lift
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

    fig.text(0.075, 0.935, title, fontsize=27, fontfamily=SERIF, fontweight="bold", color=INK, va="bottom")
    fig.text(0.075, 0.922, subtitle, fontsize=10.6, color=INK2, va="top", linespacing=1.45)
    fig.text(0.075, 0.016, footnote, fontsize=7.9, color=MUTED, va="bottom", linespacing=1.55)
    save(fig, stem)
    return {g: [round(float(v), 4) for v in summary(vals[g])] for g in ORDER}
