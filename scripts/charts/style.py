"""Shared look and data loading for the standalone charts in docs/charts/."""

import json
import math
from pathlib import Path

import matplotlib
import numpy as np

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
    "Sources: Central Elections Committee 2022 final results; CEC 2026 results by locality, all ballot boxes counted (31 Oct 2026, not yet certified)."
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
            "balance2026": l.get("balance2026"),
            "balance_change": l.get("balanceChange"),
            "bloc22": l["classification"]["blocVotes"],
            "bloc26": l.get("blocVotes2026"),
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


def _betacf(a, b, x, iters=300, eps=1e-15):
    """Continued fraction for the regularized incomplete beta function (modified Lentz)."""
    tiny = 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, iters + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > tiny else tiny)
        c = 1 + aa / c if abs(1 + aa / c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > tiny else tiny)
        c = 1 + aa / c if abs(1 + aa / c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1) < eps:
            break
    return h


def _betainc(a, b, x):
    """Regularized incomplete beta I_x(a, b)."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(lbeta) * _betacf(a, b, x) / a
    return 1 - math.exp(lbeta) * _betacf(b, a, 1 - x) / b


def t_cdf(t, df):
    """Student-t CDF for real df > 0."""
    x = df / (df + t * t)
    tail = 0.5 * _betainc(df / 2, 0.5, x)
    return 1 - tail if t > 0 else tail


def t975(df):
    """Two-sided 95% Student-t critical value (exact, by bisection on the CDF); df may be fractional."""
    lo, hi = 0.0, 1000.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_cdf(mid, df) < 0.975:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def summary(x):
    q1, med, q3 = np.quantile(x, [0.25, 0.5, 0.75])  # linear interpolation, as in src/lib/stats.ts
    mean = x.mean()
    half = t975(len(x) - 1) * x.std(ddof=1) / np.sqrt(len(x))
    return q1, med, q3, mean, mean - half, mean + half


def weighted_quantiles(x, w, qs):
    """Quantiles of x with weights w: the value below which a share q of the total weight lies (midpoint rule)."""
    order = np.argsort(x)
    x, w = x[order], w[order]
    cum = (np.cumsum(w) - 0.5 * w) / w.sum()
    return np.interp(qs, cum, x)


def summary_weighted(x, w):
    """Weighted q1, median, q3, mean and 95% CI of the mean.

    SE uses the ratio-estimator (sandwich) form √(Σw²(x−μ)²) ÷ Σw with a small-sample n/(n−1) factor;
    the t value uses the effective number of observations n_eff = (Σw)² ÷ Σw²."""
    w = w / w.sum()
    q1, med, q3 = weighted_quantiles(x, w, [0.25, 0.5, 0.75])
    mean = float(np.sum(w * x))
    n = len(x)
    se = np.sqrt(np.sum(w**2 * (x - mean) ** 2) * n / (n - 1))
    n_eff = 1 / np.sum(w**2)
    half = t975(max(n_eff - 1, 1)) * se
    return q1, med, q3, mean, mean - half, mean + half, n_eff
