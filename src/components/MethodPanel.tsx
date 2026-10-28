import type { AnalysisConfig } from "../config/analysis";
import type { Dataset } from "../lib/types";
import { GROUP_LABEL } from "./LocalityInfo";
import { fmtInt } from "../lib/format";

export function MethodPanel({ dataset, cfg }: { dataset: Dataset; cfg: AnalysisConfig }) {
  const groups = ["pro_netanyahu", "anti_netanyahu", "arab_parties", "other_or_unclassified"] as const;
  return (
    <div className="method">
      <h3>Two separate dimensions</h3>
      <p><strong>Color hue</strong> is fixed by the 2022 results and never by 2026 votes. <strong>Lightness</strong> shows only the change in turnout between 2022 and 2026, in percentage points, on one symmetric scale (±{cfg.color.maxAbsChangePp} pp) shared by every locality.</p>

      <h3>Classification (2022)</h3>
      <ol>
        <li>The individual party with the most valid votes is the locality's top party.</li>
        <li>If that party is an Arab party, the locality is <strong>gray</strong>, whatever its share. Arab parties' combined share does not matter. Ties: gray only if every tied party is Arab; ties are always flagged.</li>
        <li>Otherwise, <code>balance = (pro − anti) ÷ (pro + anti)</code> sets a continuous hue from blue (−1) through purple (0) to red (+1). With no bloc votes the balance is unavailable and no hue is invented.</li>
      </ol>

      <h3>Turnout</h3>
      <p>{dataset.meta.turnoutDefinition}</p>
      {dataset.meta.primary2026 === "feed" ? (
        <p>2026 per ballot box: the CEC 22:00 election-day turnout report (each box's last reported voters and eligible voters). Boxes missing from that report use the CEC vote count instead (flagged). Boxes last updated before 21:30 are flagged as stale: they under-state turnout, by about 3% for updates at 20:00–21:29 and by much more for earlier ones. Coverage is measured against the CEC roster of all boxes.</p>
      ) : (
        <p>2026 per ballot box: the counted figure where the box is in the CEC count; otherwise the 22:00 election-day turnout feed (preliminary, flagged; boxes last updated before 21:30 flagged as stale). Coverage is measured against the CEC roster of all boxes.</p>
      )}

      <h3>Party groups</h3>
      {groups.map((g) => (
        <div key={g}>
          <h4>{GROUP_LABEL[g]}</h4>
          <ul className="party-list">
            {dataset.parties.filter((p) => p.group === g).sort((a, b) => (b.national_votes ?? 0) - (a.national_votes ?? 0)).map((p) => (
              <li key={p.letter}>
                {p.name_en} <span className="muted">({p.letter}, {fmtInt(p.national_votes)} votes)</span>
                {p.note && <div className="small muted">{p.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="small muted">The mapping lives in config/parties-2022.json; color and summary settings in src/config/analysis.ts. Full documentation: docs/METHODOLOGY.md and docs/DATA.md in the repository.</p>
    </div>
  );
}
