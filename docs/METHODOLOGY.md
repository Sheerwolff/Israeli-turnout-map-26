# Methodology

The explorer shows two independent properties of every Israeli locality:

| Encoding | Variable | Source | Changes with 2026 votes? |
|---|---|---|---|
| **Hue** | 2022 political composition | 2022 results only | **No** |
| **Lightness** | `turnout_change_pp = turnout_2026_pct − turnout_2022_pct` | Both elections | Yes (that is the point) |

A dark red locality leaned toward the Netanyahu coalition in 2022 **and** its turnout rose. A light blue locality leaned toward the opposition in 2022 **and** its turnout fell. Darkness never means stronger political support.

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

The app labels the two blocs **Netanyahu coalition** (the lists that formed the 37th government after the 2022 election) and **Opposition** (the Zionist lists of the outgoing coalition that declared against a Netanyahu-led government). The Arab parties were also in opposition after 2022, but they are kept as their own group. The internal identifiers `pro_netanyahu` and `anti_netanyahu` are unchanged.

| Group | 2022 lists (ballot letters) |
|---|---|
| `pro_netanyahu` (shown as **Netanyahu coalition**) | Likud (מחל), Religious Zionism (ט), Shas (שס), United Torah Judaism (ג) |
| `anti_netanyahu` (shown as **Opposition**) | Yesh Atid (פה), National Unity (כן), Yisrael Beiteinu (ל), Labor (אמת), Meretz (מרצ) |
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

### 2026 sources

Since 31 Oct 2026 the 2026 figures come from the **CEC results file by locality** (`data/raw/2026/expc.csv`, supplied by the project owner). All 12,018 ballot boxes are counted and every locality's eligible voters match the CEC roster, so coverage is 100% everywhere. The file has 5,716,673 votes in total, including 451,988 double envelopes, a national turnout of 78.0%. Locality turnout is computed as for 2022, with double envelopes excluded. The results are not yet certified final.

Earlier builds used the CEC 22:00 election-day turnout report, filled in from a partial count. Boxes in that report that last updated before 21:30 under-stated turnout by about 3% or more. The report is kept in `data/raw/2026/` for reference. The pipeline can still combine a box-level count with the report: `primary2026` in `config/sources.json` decides which source wins for a box present in both.

### 2026 balance

Each locality's 2026 balance uses the same formula as 2022, `(coalition − opposition) ÷ (coalition + opposition)`, with the 2026 lists mapped in `config/parties-2026.json`:

| Group | 2026 lists |
|---|---|
| Netanyahu coalition | Likud, Shas, United Torah Judaism, Otzma Yehudit, Religious Zionism, Noam (the outgoing 37th government) |
| Opposition | Yashar, Beyachad, the Democrats, Yisrael Beiteinu |
| Arab parties (excluded) | Joint List, Ra'am |
| Unclassified (excluded) | HaMiluimnikim & HaKalkalit, Amcha Yisrael (the project owner's decision, as for Jewish Home in 2022), and all small lists |

`balanceChange = balance2026 − balance2022`. A negative value means the locality moved toward the opposition, and −0.10 means the gap between the blocs moved 10 points. The 2022 groups and map colors do not use 2026 votes. Across all localities combined, the balance moved from +0.121 to +0.055 (−0.066).

In Arab-plurality localities the coalition and opposition receive few votes, so the balance rests on small numbers and swings widely. Three such localities have no balance in one of the years.

## 3. Color

Implemented as a pure function in `src/lib/color.ts`:

```
color = f(political_balance, turnout_change_pp, is_arab_party_plurality)
```

The colors are built in **OKLCH**, a perceptual color space, so equal lightness values look equally light whatever the hue.

- **Hue (categorical, the default).** Each non-gray locality takes one of three hues from its balance:

  | Category | Balance | OKLCH hue |
  |---|---|---|
  | Blue: opposition-leaning | ≤ −0.1 | 255 |
  | Purple: relatively balanced | between −0.1 and +0.1 | 321 |
  | Red: Netanyahu-coalition-leaning | ≥ +0.1 | 27 |

  Both cut-offs are inclusive on the outer side and live in `src/config/analysis.ts` (`TENDENCY`). The same object defines the dashboard's summary groups, so the map's colors and the group statistics always agree. A balance of ±0.1 means the larger bloc has at most 55% of the two blocs' combined vote (55/45), i.e. a gap of up to 10 points. The band was narrowed from ±0.2 (60/40) at the project owner's request, since a 20-point gap is not balanced. With the current data the groups hold 604 blue, 56 purple and 429 red localities. Within a category the hue does not show how strong the lean is. The exact balance is still in the tooltip, the detail panel, the scatter plot and the balance filter.
- **Hue (continuous, optional).** Set `hueMode: "continuous"` to make the hue linear in the balance, from blue (balance −1) through purple (0) to red (+1). The legend switches to nine balance columns automatically.
- **Why purple, not gray, for balanced.** Gray is reserved for the Arab-plurality category.
- **Gray.** Chroma 0, with the **same** lightness function. The same turnout change gives the same lightness for gray, blue, purple and red localities. The tests check this on the rendered sRGB values.
- **Lightness.**

  ```
  L = 0.63 − 0.31 × clamp(Δ / max, −1, 1)
  ```

  This is symmetric around zero, with darker meaning increase. The direction, neutral lightness and span are set in `src/config/analysis.ts`. The direction can also be flipped from the legend.
- **Gamut mapping.** Where sRGB cannot show the target chroma, chroma alone is lowered. Lightness and hue are never altered.
- **Clipping.** Changes beyond ±max take the end color, get a dotted outline on the map, and show their true value and a "beyond scale" tag in the tooltip and detail panel.
- **Not quantile-based.** One shade means the same number of pp everywhere. Colors are never rescaled per political group.

### Scale bounds

Observed distribution of |Δ| (pp) with the current data (2026 counted results): median 5.1, 90th percentile 19.3, 95th percentile 30.2, maximum 55.3. The distribution is strongly bimodal:

| Group | n | 5th pct | Median | 95th pct |
|---|---|---|---|---|
| Blue–red localities | 1,089 | −1.3 | +4.6 | +10.8 |
| Gray localities | 126 | +14.6 | +28.2 | +40.4 |

A shared scale has to choose between the two groups. Lightness runs from 0.32 (darkest) to 0.94 (lightest), as wide as the hues stay recognisable at both ends. The default bound is **±10 pp**: the middle half of blue–red localities (+2.3 to +6.5 pp) then spans about 0.13 of lightness. 79 of 1,089 blue–red localities (7%) and most gray localities exceed the bound; they are clipped, which the map flags rather than hides. The legend offers ±6, 8, 10, 12, 20, 30 and 45 pp. Choosing ±45 pp shows every locality unclipped, but compresses the differences among non-gray localities.

## 4. Dashboard statistics

Implemented in `src/lib/stats.ts`.

- **Unweighted mean and median** across localities. Each locality counts once, so this is *not* a national figure.
- **Voter-weighted change.** `Σ voters₂₀₂₆ / Σ eligible₂₀₂₆ − Σ voters₂₀₂₂ / Σ eligible₂₀₂₂` over the localities currently shown.
- **Increased / unchanged / decreased.** The "unchanged" band is |Δ| < 0.5 pp (`unchangedThresholdPp`).
- **Groups**: opposition-leaning (balance ≤ −0.1), balanced, coalition-leaning (≥ +0.1), and gray, the same categories as the map's hues. The cut-offs are in `src/config/analysis.ts`. Box plots use Tukey whiskers at 1.5 × IQR.

None of these comparisons is causal. The groups also differ in locality size, demography, geography, and 2026 count completeness, and the scatter plot and box plots show associations only.

## 5. Filters

Filters change which localities are shown and summarised, never how any locality is classified or colored. The filter panel always states how many localities remain. Excluded localities are listed in the Data quality tab with their reasons, never silently dropped.
