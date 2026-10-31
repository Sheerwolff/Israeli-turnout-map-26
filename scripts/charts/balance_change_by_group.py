"""Standalone chart: change in the coalition–opposition balance, 2022 → 2026, in each 2022 political group.

balance = (coalition − opposition) ÷ (coalition + opposition) votes, using config/parties-2022.json for
2022 and config/parties-2026.json for 2026. Same layout as turnout_box_by_group.py.
Writes docs/charts/balance-change-by-group.{png,svg,pdf} (each locality counts once) and
docs/charts/balance-change-by-group-weighted.{png,svg,pdf} (each locality weighted by its 2022 eligible voters).

    python scripts/charts/balance_change_by_group.py
"""

import numpy as np

from group_chart import ORDER, draw_group_chart
from style import load_rows, signed

rows = load_rows()
have = [r for r in rows if r["balance_change"] is not None]
vals = {g: np.array([r["balance_change"] for r in have if r["group"] == g]) for g in ORDER}
weights = {g: np.array([r["eligible"] for r in have if r["group"] == g], dtype=float) for g in ORDER}
missing = {g: sum(1 for r in rows if r["group"] == g and r["balance_change"] is None) for g in ORDER}

# All localities combined: balance of summed bloc votes in each year.
tot = {y: {"pro": 0, "anti": 0} for y in (2022, 2026)}
for r in rows:
    for y, bloc in ((2022, r["bloc22"]), (2026, r["bloc26"])):
        if bloc:
            tot[y]["pro"] += bloc["pro_netanyahu"]
            tot[y]["anti"] += bloc["anti_netanyahu"]
bal = {y: (t["pro"] - t["anti"]) / (t["pro"] + t["anti"]) for y, t in tot.items()}
overall = bal[2026] - bal[2022]


def row_note(g):
    if g == "gray":
        extra = f" ({missing[g]} more have none)" if missing[g] else ""
        return f"Few bloc votes here, so the balance\nswings widely{extra}"
    return ""


FOOT = (
    "Balance = (coalition − opposition) ÷ (coalition + opposition) votes; Arab-party and other votes are excluded.  Groups use 2022 results only.\n"
    "2022 coalition: Likud, Religious Zionism, Shas, UTJ.  Opposition: Yesh Atid, National Unity, Yisrael Beiteinu, Labor, Meretz.\n"
    "2026 coalition: Likud, Shas, UTJ, Otzma Yehudit, Religious Zionism, Noam.  Opposition: Yashar, Beyachad, the Democrats, Yisrael Beiteinu.  "
    "HaMiluimnikim & HaKalkalit and Amcha Yisrael are unclassified.\n"
    "Sources: Central Elections Committee 2022 final results; CEC 2026 results by locality, all boxes counted "
    f"(31 Oct 2026, not yet certified).  n = {sum(len(v) for v in vals.values()):,} localities."
)
COMMON = dict(
    # Zoomed so the confidence intervals are legible; localities outside are counted at the row edges.
    x_range=(-0.6, 0.3),
    ticks=[round(v, 1) for v in np.arange(-0.6, 0.31, 0.1)],
    tick_label=lambda v: signed(v, 1),
    value_label=lambda v, unit=True: signed(v, 3),
    xlabel="Change in political balance, 2022 → 2026      ← toward the opposition   ·   toward the Netanyahu coalition →",
    row_note=row_note,
    reference=(overall, f"all localities combined {signed(overall, 3)}"),
)

stats = draw_group_chart(
    vals,
    title="How the coalition–opposition balance shifted",
    subtitle="Change in each locality's balance between the Netanyahu coalition and the opposition from the 2022 to the 2026 Knesset election,\n"
    "grouped by how localities voted in 2022. A change of −0.10 means the gap between the two blocs moved 10 points toward the opposition.",
    footnote=FOOT,
    stem="balance-change-by-group",
    **COMMON,
)

stats_w = draw_group_chart(
    vals,
    weights=weights,
    title="How the balance shifted, weighted by locality size",
    subtitle="Same change in coalition–opposition balance, 2022 → 2026, with each locality weighted by its number of eligible voters in 2022,\n"
    "so large cities count for more than villages. A change of −0.10 means the gap between the two blocs moved 10 points toward the opposition.",
    footnote=FOOT.replace("Groups use 2022 results only.", "Groups use 2022 results only.  Weights: 2022 eligible voters; CI uses the effective number of localities."),
    stem="balance-change-by-group-weighted",
    key_text="Diamond: weighted mean  ·  whiskers: 95% CI  ·  box: middle half of voters, thin line: weighted median  ·  dot area: eligible voters",
    mean_word="weighted mean",
    **COMMON,
)
print("overall", round(bal[2022], 4), round(bal[2026], 4), round(overall, 4))
print("unweighted", stats, missing)
print("weighted", stats_w)
