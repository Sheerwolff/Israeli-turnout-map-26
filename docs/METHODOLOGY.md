# Methodology

The explorer shows two independent properties of every Israeli locality:

| Encoding | Variable | Source | Changes with 2026 votes? |
|---|---|---|---|
| **Hue** | 2022 political composition | 2022 results only | **No** |
| **Lightness** | `turnout_change_pp = turnout_2026_pct − turnout_2022_pct` | Both elections | Yes (that is the point) |

A dark red locality leaned pro-Netanyahu in 2022 **and** its turnout rose. A light blue locality leaned anti-Netanyahu in 2022 **and** its turnout fell. Darkness never means stronger political support.

## 1. Political classification (2022)

Implemented in `src/lib/classification.ts`. The party mapping is `config/parties-2022.json`, which is the single source of truth.

1. **Top party.** For each locality, the individual list with the most valid votes (`top_party_2022`).
2. **Arab-party exception.** If that single list is an Arab party (Ra'am, Hadash–Ta'al or Balad), the locality is **gray**, whatever the party's share. The Arab parties' *combined* share is irrelevant. If an Arab party is not the top party, the locality gets the regular blue–red classification, however large the combined Arab-party share.
3. **Balance.** For every other locality:

   ```
   political_balance = (pro_netanyahu_votes − anti_netanyahu_votes) / (pro_netanyahu_votes + anti_netanyahu_votes)
   ```

   It runs from −1 (all bloc votes anti) through 0 (equal) to +1 (all bloc votes pro). Arab-party votes and `other_or_unclassified` votes are excluded from the denominator, so the balance describes only votes cast for the two blocs, not the whole electorate. `pro_vote_share`, `anti_vote_share`, the Arab and other shares (all over valid votes), and the full per-list results are shown in the detail panel.

**Tie rule.** If two or more lists share the top vote count, the locality is gray only if *every* tied list is an Arab party (an Arab party leads however the tie is broken). If the tie mixes Arab and non-Arab lists, no single Arab party is the top party, so the locality uses the blue–red balance. Every tie is flagged (`top_party_tie`, plus `top_party_tie_arab_and_non_arab` for mixed ties) and listed in the Data quality tab. The current data have 5 ties, all between non-Arab lists.

**Unavailable balance.** If `pro + anti = 0`, or votes for letters missing from the config exceed 5% of valid votes, the balance is `null` and no hue is invented. Such a locality is excluded unless it is gray. The pipeline refuses to build if the 2022 file contains a letter that the config does not list.

### Party groups

| Group | 2022 lists (ballot letters) |
|---|---|
| `pro_netanyahu` | Likud (מחל), Religious Zionism (ט), Shas (שס), United Torah Judaism (ג) |
| `anti_netanyahu` | Yesh Atid (פה), National Unity (כן), Yisrael Beiteinu (ל), Labor (אמת), Meretz (מרצ) |
| `arab_parties` | Ra'am (עם), Hadash–Ta'al (ום), Balad (ד) |
| `other_or_unclassified` | Jewish Home (ב), see the note in the config file, and all 27 lists that won no seats and did not commit to a bloc |

These are deliberate, documented choices. To change one, edit the `group` field in `config/parties-2022.json` and run `npm run build:data`. The map, dashboard and tests all read from that file.

## 2. Turnout

Implemented in `src/lib/turnout.ts` and `src/lib/build.ts`.

**Definition (CEC).** `turnout = voters ÷ eligible × 100`, where:
- *voters* (מצביעים) are the envelopes cast at a locality's ballot boxes, valid plus invalid;
- *eligible* (בזב) are the registered voters assigned to those boxes.

Party votes are never used as the numerator, and vote counts are never used in place of a rate.

**Double envelopes.** Votes by soldiers, diplomats, prisoners, hospital patients and similar voters (CEC locality code 9999) are counted centrally and cannot be attributed to a locality. They are excluded from locality turnout in both years. As a result, locality turnout is lower than national turnout: in 2022, 63.8% of eligible voters cast a vote at their locality's boxes, against an official national turnout of 70.63% that includes 462,807 double envelopes. The same definition is applied in both years, so the change in pp is comparable as long as the share of double-envelope voters is similar.

**Change.** `turnout_change_pp = turnout_2026_pct − turnout_2022_pct`. This is a difference in percentage points, never a relative percentage change. 60% → 70% is +10 pp, and 80% → 75% and 40% → 35% are both −5 pp, with identical lightness.

### 2026 while the count is not final

For each 2026 ballot box on the CEC roster:

1. If the box is in the **CEC count** (`expb.csv`), its counted *voters* and *eligible* are used.
2. Otherwise, if it is in the **22:00 election-day turnout feed**, the feed's figures are used. The locality is flagged `uses_preliminary_feed`. A box whose last feed update was before 21:30 is also flagged `uses_stale_feed`: feed values are cumulative reports, so an early last update under-states turnout. Across boxes in both sources, stale feed boxes report about 4% fewer voters than the count.
3. Otherwise the box is counted as missing.

`coverage = Σ eligible of boxes with data ÷ Σ eligible on the roster`. Localities below 98% are flagged `partial_2026_coverage` and drawn with a dashed outline. The Filters panel can drop localities that use feed figures, or that fall below a coverage threshold.

When final results are published, replace `data/raw/2026/expb.csv`, or point `results2026` in `config/sources.json` at the final `expc.csv`. Then set `mode` to `official_final` and rebuild. Nothing else changes.

## 3. Color

Implemented as a pure function in `src/lib/color.ts`:

```
color = f(political_balance, turnout_change_pp, is_arab_party_plurality)
```

The colors are built in **OKLCH**, a perceptual color space, so equal lightness values look equally light whatever the hue.

- **Hue.** Linear in the balance, from blue (OKLCH hue 255, balance −1) through purple (balance 0) to red (hue 27, balance +1). The midpoint is purple rather than gray, because gray is reserved for the Arab-plurality category. The hue is continuous and has no discrete political categories.
- **Gray.** Chroma 0, with the **same** lightness function. The same turnout change gives the same lightness for gray, blue, purple and red localities. The tests check this on the rendered sRGB values.
- **Lightness.**

  ```
  L = 0.67 − 0.23 × clamp(Δ / max, −1, 1)
  ```

  This is symmetric around zero, with darker meaning increase. The direction, neutral lightness and span are set in `src/config/analysis.ts`. The direction can also be flipped from the legend.
- **Gamut mapping.** Where sRGB cannot show the target chroma, chroma alone is lowered. Lightness and hue are never altered.
- **Clipping.** Changes beyond ±max take the end color, get a dotted outline on the map, and show their true value and a "beyond scale" tag in the tooltip and detail panel.
- **Not quantile-based.** One shade means the same number of pp everywhere. Colors are never rescaled per political group.

### Scale bounds

Observed distribution of |Δ| (pp) with the 28 Oct 2026 data: median 5.1, 90th percentile 19.3, 95th percentile 29.6, maximum 55.3. The distribution is strongly bimodal:

| Group | n | 5th pct | Median | 95th pct |
|---|---|---|---|---|
| Blue–red localities | 1,089 | −1.4 | +4.6 | +10.7 |
| Gray localities | 126 | +14.4 | +27.9 | +40.4 |

A shared scale has to choose between the two groups. The default bound of **±12 pp** covers the 5th–95th percentile range of the blue–red localities, so their differences stay visible. Most gray localities are then clipped, which the map flags rather than hides. The legend offers ±6, 8, 12, 20, 30 and 45 pp. Choosing ±45 pp shows every locality unclipped, but compresses the differences among non-gray localities.

## 4. Dashboard statistics

Implemented in `src/lib/stats.ts`.

- **Unweighted mean and median** across localities. Each locality counts once, so this is *not* a national figure.
- **Voter-weighted change.** `Σ voters₂₀₂₆ / Σ eligible₂₀₂₆ − Σ voters₂₀₂₂ / Σ eligible₂₀₂₂` over the localities currently shown.
- **Increased / unchanged / decreased.** The "unchanged" band is |Δ| < 0.5 pp (`unchangedThresholdPp`).
- **Summary groups**, for the dashboard only: anti-leaning (balance ≤ −0.2), balanced, pro-leaning (≥ +0.2), and gray. The cut-offs are in `src/config/analysis.ts`. Box plots use Tukey whiskers at 1.5 × IQR.

None of these comparisons is causal. The groups also differ in locality size, demography, geography, and 2026 count completeness, and the scatter plot and box plots show associations only.

## 5. Filters

Filters change which localities are shown and summarised, never how any locality is classified or colored. The filter panel always states how many localities remain. Excluded localities are listed in the Data quality tab with their reasons, never silently dropped.
