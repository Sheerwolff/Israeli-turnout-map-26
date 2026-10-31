"""Standalone chart: distribution of 2022→2026 turnout change in each 2022 political group.

Diamond = mean, whiskers = its 95% confidence interval (mean ± t × SD/√n), faint box = middle half
of localities with its median line, dots = every locality. Writes docs/charts/turnout-box-by-group.{png,svg,pdf}.

    python scripts/charts/turnout_box_by_group.py
"""

import numpy as np

from group_chart import ORDER, draw_group_chart
from style import FOOTNOTE, load_rows, signed

rows = load_rows()
vals = {g: np.array([r["change"] for r in rows if r["group"] == g]) for g in ORDER}

# Nir Oz, Be'eri, Kfar Aza, Holit: the sharpest drops, named in the out-of-range note.
NEGEV_CODES = {"69", "399", "845", "1239"}
X0 = -10


def below_note(g):
    kib = [r for r in rows if r["code"] in NEGEV_CODES and r["group"] == g and r["change"] < X0]
    return ", incl. Nir Oz, Be'eri, Kfar Aza, Holit (western Negev kibbutzim)" if len(kib) == len(NEGEV_CODES) else ""


stats = draw_group_chart(
    vals,
    # Zoomed so the confidence intervals (1–3 pp wide) are legible; localities outside are counted at the row edges.
    x_range=(X0, 35),
    ticks=list(range(X0, 36, 5)),
    tick_label=signed,
    value_label=lambda v, unit=True: f"{signed(v, 1)}{' pp' if unit else ''}",
    xlabel="Change in turnout, 2022 → 2026 (percentage points)",
    title="How turnout changed in each political group",
    subtitle="Change in turnout from the 2022 to the 2026 Knesset election in Israeli localities, grouped by how they voted in 2022.\n"
    "Each locality counts once, whatever its size.",
    footnote=FOOTNOTE + f"  n = {len(rows):,} localities.",
    stem="turnout-box-by-group",
    below_note=below_note,
)
print(stats)
