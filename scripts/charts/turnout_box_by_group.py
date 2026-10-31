"""Standalone chart: distribution of 2022→2026 turnout change in each 2022 political group.

Diamond = mean, whiskers = its 95% confidence interval (mean ± t × SD/√n), faint box = middle half
of localities with its median line, dots = every locality. Writes docs/charts/turnout-box-by-group.{png,svg,pdf}
(each locality counts once) and docs/charts/turnout-box-by-group-weighted.{png,svg,pdf} (each locality weighted by
its 2022 eligible voters).

    python scripts/charts/turnout_box_by_group.py
"""

import json

import numpy as np

from group_chart import ORDER, draw_group_chart
from style import DATASET, FOOTNOTE, load_rows, signed

rows = load_rows()
vals = {g: np.array([r["change"] for r in rows if r["group"] == g]) for g in ORDER}
weights = {g: np.array([r["eligible"] for r in rows if r["group"] == g], dtype=float) for g in ORDER}

# All localities combined: Σ votes ÷ Σ eligible in each year (locality-attributed votes, double envelopes excluded).
national = json.loads(DATASET.read_text(encoding="utf-8"))["meta"]["national"]
overall = national["y2026"]["localityTurnoutPct"] - national["y2022"]["localityTurnoutPct"]

# Nir Oz, Be'eri, Kfar Aza, Holit: the sharpest drops, named in the out-of-range note.
NEGEV_CODES = {"69", "399", "845", "1239"}
X0 = -10


def below_note(g):
    kib = [r for r in rows if r["code"] in NEGEV_CODES and r["group"] == g and r["change"] < X0]
    return ", incl. Nir Oz, Be'eri, Kfar Aza, Holit (western Negev kibbutzim)" if len(kib) == len(NEGEV_CODES) else ""


COMMON = dict(
    # Zoomed so the confidence intervals (1–3 pp wide) are legible; localities outside are counted at the row edges.
    x_range=(X0, 35),
    ticks=list(range(X0, 36, 5)),
    tick_label=signed,
    value_label=lambda v, unit=True: f"{signed(v, 1)}{' pp' if unit else ''}",
    xlabel="Change in turnout, 2022 → 2026 (percentage points)",
    below_note=below_note,
)

stats = draw_group_chart(
    vals,
    title="How turnout changed in each political group",
    subtitle="Change in turnout from the 2022 to the 2026 Knesset election in Israeli localities, grouped by how they voted in 2022.\n"
    "Each locality counts once, whatever its size.",
    footnote=FOOTNOTE + f"  n = {len(rows):,} localities.",
    stem="turnout-box-by-group",
    **COMMON,
)

stats_w = draw_group_chart(
    vals,
    weights=weights,
    title="How turnout changed, weighted by locality size",
    subtitle="Change in turnout from the 2022 to the 2026 Knesset election, grouped by how localities voted in 2022, with each locality\n"
    "weighted by its number of eligible voters in 2022, so large cities count for more than villages.",
    footnote=FOOTNOTE + f"  n = {len(rows):,} localities.\n"
    "Weights: 2022 eligible voters.  The CI uses the effective number of localities, (Σw)² ÷ Σw².  "
    "All localities combined = Σ votes ÷ Σ eligible voters in each year.",
    stem="turnout-box-by-group-weighted",
    key_text="Diamond: weighted mean  ·  whiskers: 95% CI  ·  box: middle half of voters, thin line: weighted median  ·  dot area: eligible voters",
    mean_word="weighted mean",
    reference=(overall, f"all localities combined {signed(overall, 1)} pp"),
    **COMMON,
)
print("overall", round(overall, 3))
print("unweighted", stats)
print("weighted", stats_w)
