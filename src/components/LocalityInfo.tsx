import type { ColorResult } from "../lib/color";
import { fmtBalance, fmtInt, fmtPct, fmtPp, fmtShare, POPULATION_GROUP_EN, WARNING_SHORT, WARNING_TEXT } from "../lib/format";
import type { LocalityRecord, PartyDef, PartyGroup } from "../lib/types";

export const GROUP_LABEL: Record<PartyGroup, string> = {
  pro_netanyahu: "Pro-Netanyahu bloc",
  anti_netanyahu: "Anti-Netanyahu bloc",
  arab_parties: "Arab parties",
  other_or_unclassified: "Other / unclassified",
};

export function partyName(letter: string, parties: Map<string, PartyDef>) {
  const p = parties.get(letter);
  return p ? p.name_en : letter;
}

export function classificationText(r: LocalityRecord): string {
  const c = r.classification;
  if (!c) return "Not classified (no 2022 results)";
  if (c.category === "arab_plurality") return "Gray — Arab-party plurality in 2022";
  if (c.category === "bloc_balance") return "Blue–red political balance (2022)";
  return "Political balance unavailable";
}

export function topPartyText(r: LocalityRecord, parties: Map<string, PartyDef>): string {
  const c = r.classification;
  if (!c || !c.topParties.length) return "—";
  const names = c.topParties.map((l) => partyName(l, parties)).join(" = ");
  return `${names} (${fmtShare(c.topPartyShare)})${c.isTopTie ? " — tie" : ""}`;
}

/** Compact hover content. */
export function TooltipContent({ r, color, parties }: { r: LocalityRecord; color: ColorResult | undefined; parties: Map<string, PartyDef> }) {
  return (
    <div>
      <div className="tt-title">
        <span dir="rtl">{r.name_he}</span>
        {r.name_en && <span className="muted"> · {r.name_en}</span>}
      </div>
      <table className="tt-table">
        <tbody>
          <tr><th>Classification</th><td>{classificationText(r)}</td></tr>
          <tr><th>2022 top party</th><td>{topPartyText(r, parties)}</td></tr>
          <tr><th>2022 balance</th><td>{fmtBalance(r.classification?.balance)}{r.classification?.isArabPlurality ? " (not used for color)" : ""}</td></tr>
          <tr><th>Turnout 2022</th><td>{fmtPct(r.y2022?.turnoutPct)}</td></tr>
          <tr><th>Turnout 2026</th><td>{fmtPct(r.y2026?.turnoutPct)}</td></tr>
          <tr>
            <th>Change</th>
            <td>
              <strong>{fmtPp(r.turnoutChangePp)}</strong>
              {color?.clipped && <span className="tag">beyond scale</span>}
            </td>
          </tr>
        </tbody>
      </table>
      {r.exclusionReasons.length > 0 && <div className="tt-warn">Excluded: {r.exclusionReasons.join("; ")}</div>}
      {r.warnings.some((w) => WARNING_SHORT[w]) && <div className="tt-warn">⚠ {r.warnings.filter((w) => WARNING_SHORT[w]).map((w) => WARNING_SHORT[w]).join(" · ")}</div>}
      <div className="muted small">Click for details</div>
    </div>
  );
}

const BLOC_ORDER: PartyGroup[] = ["anti_netanyahu", "pro_netanyahu", "arab_parties", "other_or_unclassified"];
const BLOC_COLOR: Record<PartyGroup, string> = {
  anti_netanyahu: "var(--bloc-anti)",
  pro_netanyahu: "var(--bloc-pro)",
  arab_parties: "var(--bloc-arab)",
  other_or_unclassified: "var(--bloc-other)",
};

function BlocBar({ r }: { r: LocalityRecord }) {
  const c = r.classification!;
  const total = c.validVotes || 1;
  let x = 0;
  return (
    <div>
      <svg width="100%" height="18" viewBox="0 0 100 18" preserveAspectRatio="none" role="img" aria-label="2022 vote shares by bloc">
        {BLOC_ORDER.map((g) => {
          const w = (c.blocVotes[g] / total) * 100;
          const rect = <rect key={g} x={x} y={2} width={Math.max(0, w - 0.4)} height={14} fill={BLOC_COLOR[g]} />;
          x += w;
          return rect;
        })}
      </svg>
      <ul className="bloc-list">
        {BLOC_ORDER.map((g) => (
          <li key={g}>
            <span className="swatch" style={{ background: BLOC_COLOR[g] }} />
            {GROUP_LABEL[g]} <strong>{fmtShare(c.blocVotes[g] / total)}</strong> <span className="muted">({fmtInt(c.blocVotes[g])})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BalanceGauge({ balance, gradient }: { balance: number | null; gradient: string }) {
  return (
    <div className="gauge">
      <div className="gauge-bar" style={{ background: gradient }} />
      {balance !== null && <div className="gauge-mark" style={{ left: `${((balance + 1) / 2) * 100}%` }} />}
      <div className="gauge-labels">
        <span>−1 anti</span>
        <span>0</span>
        <span>pro +1</span>
      </div>
    </div>
  );
}

function TurnoutChart({ t22, t26 }: { t22: number | null; t26: number | null }) {
  const W = 300;
  const bar = (y: number, v: number | null, label: string) => (
    <g>
      <text x={0} y={y + 13} className="tick">{label}</text>
      <rect x={40} y={y} width={W - 100} height={18} rx={3} className="track" />
      {v !== null && <rect x={40} y={y} width={((W - 100) * v) / 100} height={18} rx={3} className="bar" />}
      <text x={W - 54} y={y + 13} className="value">{fmtPct(v)}</text>
    </g>
  );
  return (
    <svg width="100%" viewBox={`0 0 ${W} 52`} role="img" aria-label={`Turnout 2022 ${fmtPct(t22)}, 2026 ${fmtPct(t26)}`}>
      {bar(2, t22, "2022")}
      {bar(30, t26, "2026")}
    </svg>
  );
}

export function DetailPanel({ r, color, parties, gradient, onClose }: { r: LocalityRecord; color: ColorResult | undefined; parties: Map<string, PartyDef>; gradient: string; onClose: () => void }) {
  const c = r.classification;
  const y22 = r.y2022;
  const y26 = r.y2026;
  const partyRows = y22 ? Object.entries(y22.votes).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]) : [];
  return (
    <article className="detail">
      <header className="detail-head">
        <div className="detail-swatch" style={{ background: color?.hex ?? "transparent" }} aria-hidden />
        <div>
          <h2 dir="rtl">{r.name_he}</h2>
          <div className="muted">
            {r.name_en && <>{r.name_en} · </>}CBS/CEC code {r.code}
            {r.populationGroup && <> · {POPULATION_GROUP_EN[r.populationGroup] ?? r.populationGroup}</>}
          </div>
        </div>
        <button type="button" className="close" aria-label="Close details" onClick={onClose}>×</button>
      </header>

      {r.exclusionReasons.length > 0 && <div className="callout warn">Excluded from the analysis: {r.exclusionReasons.join("; ")}.</div>}

      <section>
        <h3>2022 political classification</h3>
        <p><strong>{classificationText(r)}</strong></p>
        {c?.isArabPlurality && (
          <p className="callout">
            An Arab party ({c.topParties.map((l) => partyName(l, parties)).join(" / ")}) was the single most-voted-for party here in 2022, with {fmtShare(c.topPartyShare)} of valid votes. This does not mean the whole electorate voted for it — see the full distribution below. Its blue–red balance is shown for reference but is not used for its color.
          </p>
        )}
        {c?.isTopTie && <p className="callout warn">Tie for the top party ({c.topParties.map((l) => partyName(l, parties)).join(", ")}). Tie rule: gray only if every tied party is an Arab party.</p>}
        <dl className="kv">
          <dt>Top party</dt><dd>{topPartyText(r, parties)}</dd>
          <dt>Political balance</dt><dd>{fmtBalance(c?.balance)}</dd>
        </dl>
        <BalanceGauge balance={c?.balance ?? null} gradient={gradient} />
        <p className="muted small">Balance = (pro − anti) ÷ (pro + anti) among votes for those two blocs only; Arab-party and other votes are excluded from it. It is not a description of the whole electorate.</p>
        {c && <BlocBar r={r} />}
      </section>

      <section>
        <h3>Turnout</h3>
        <TurnoutChart t22={y22?.turnoutPct ?? null} t26={y26?.turnoutPct ?? null} />
        <p className="big">
          Change: <strong>{fmtPp(r.turnoutChangePp)}</strong>
          {color?.clipped && <span className="tag">beyond the ±scale; color clipped</span>}
        </p>
        <table className="data">
          <thead><tr><th /><th>2022</th><th>2026</th></tr></thead>
          <tbody>
            <tr><th>Eligible voters</th><td>{fmtInt(y22?.eligible)}</td><td>{fmtInt(y26?.eligible)}</td></tr>
            <tr><th>Votes cast</th><td>{fmtInt(y22?.voters)}</td><td>{fmtInt(y26?.voters)}</td></tr>
            <tr><th>Turnout</th><td>{fmtPct(y22?.turnoutPct, 2)}</td><td>{fmtPct(y26?.turnoutPct, 2)}</td></tr>
          </tbody>
        </table>
        {y26 && (
          <p className="small">
            2026 sources: {y26.boxesFeed} box{y26.boxesFeed === 1 ? "" : "es"} from the 22:00 turnout feed{y26.boxesFeedStale > 0 && <> ({y26.boxesFeedStale} last updated before 21:30)</>}
            {y26.boxesCount > 0 && <>, {y26.boxesCount} from the vote count</>}
            {y26.boxesMissing > 0 && <>, {y26.boxesMissing} with no data yet</>}
            {y26.coverage !== null && <> · coverage {fmtShare(y26.coverage)} of {fmtInt(y26.rosterEligible)} registered</>}.
          </p>
        )}
      </section>

      {r.warnings.length > 0 && (
        <section>
          <h3>Data notes</h3>
          <ul className="warnings">
            {r.warnings.map((w) => <li key={w}>{WARNING_TEXT[w] ?? w}</li>)}
          </ul>
          {r.names.length > 1 && <p className="small muted">Names in sources: {r.names.join(" · ")}</p>}
        </section>
      )}

      {partyRows.length > 0 && (
        <details>
          <summary>All 2022 party results ({partyRows.length} lists with votes)</summary>
          <table className="data">
            <thead><tr><th>List</th><th>Group</th><th>Votes</th><th>Share</th></tr></thead>
            <tbody>
              {partyRows.map(([l, n]) => (
                <tr key={l}>
                  <td>{partyName(l, parties)} <span className="muted">({l})</span></td>
                  <td>{GROUP_LABEL[parties.get(l)?.group ?? "other_or_unclassified"]}</td>
                  <td>{fmtInt(n)}</td>
                  <td>{fmtShare(n / (y22!.valid || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="small muted">Sources: CEC 2022 results by locality; CEC 2026 count and 22:00 turnout feed; CBS boundaries. See the Method tab.</p>
    </article>
  );
}
