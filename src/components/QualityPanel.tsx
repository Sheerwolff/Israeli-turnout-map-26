import type { Dataset, LocalityRecord } from "../lib/types";

const COUNT_LABEL: Record<string, string> = {
  localities_total: "Locality codes in any election file",
  localities_in_2022: "…with 2022 results",
  localities_in_2026: "…with 2026 data",
  localities_in_both_elections: "…in both elections",
  localities_with_geometry: "…matched to a boundary polygon",
  localities_without_geometry: "…without a boundary polygon",
  geometry_features: "Boundary polygons (CBS)",
  geometry_without_election_data: "…with no election record",
  analysed: "Analysed (classified + valid turnout change)",
  analysed_on_map: "…of which drawn on the map",
  excluded: "Excluded",
  gray_arab_plurality: "Gray (Arab-party plurality)",
  top_party_ties: "Top-party ties",
  no_bloc_votes: "No votes for either bloc",
  partial_2026_coverage: "2026 coverage < 98%",
  boxes_2026_count: "2026 boxes: counted",
  boxes_2026_feed: "2026 boxes: from 22:00 feed (not yet counted)",
  boxes_2026_feed_stale: "2026 boxes: from feed, last update < 21:30",
  boxes_2026_missing: "2026 boxes: no data",
};

export function QualityPanel({ dataset, byCode, onSelect }: { dataset: Dataset; byCode: Map<number, LocalityRecord>; onSelect: (code: number) => void }) {
  const { quality, meta } = dataset;
  return (
    <div className="quality">
      <div className={`callout ${meta.mode === "official_final" ? "" : "warn"}`}>{meta.modeNote}</div>
      <h3>Join and coverage summary</h3>
      <table className="data compact">
        <tbody>
          {Object.entries(quality.counts).map(([k, v]) => (
            <tr key={k}><th>{COUNT_LABEL[k] ?? k}</th><td>{v.toLocaleString()}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>Checks</h3>
      <ul className="issues">
        {quality.issues.map((i) => (
          <li key={i.id} className={`sev-${i.severity}`}>
            <span className="sev">{i.severity}</span> {i.message}
            {i.codes.length > 0 && (
              <details>
                <summary>{i.codes.length} localit{i.codes.length === 1 ? "y" : "ies"}</summary>
                <div className="code-list">
                  {i.codes.map((c) => {
                    const r = byCode.get(c);
                    return r ? (
                      <button type="button" key={c} className="chip" onClick={() => onSelect(c)} title={`code ${c}`}>
                        {r.name_he}
                      </button>
                    ) : (
                      <span key={c} className="chip static">{c}</span>
                    );
                  })}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
      <h3>Sources</h3>
      <ul className="sources">
        {meta.sources.map((s) => (
          <li key={s.id}>
            <strong>{s.label}</strong> — {s.origin}. <span className="muted">{s.notes}</span>
            <div className="small muted mono">{s.path} · sha256 {s.sha256.slice(0, 16)}…</div>
          </li>
        ))}
      </ul>
      <p className="small muted">Built {new Date(meta.builtAt).toLocaleString()}.</p>
    </div>
  );
}
