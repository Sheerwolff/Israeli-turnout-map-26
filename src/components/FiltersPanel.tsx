import { DEFAULT_FILTERS, isDefaultFilters, type Filters } from "../lib/filters";
import { POPULATION_GROUP_EN } from "../lib/format";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  shown: number;
  analysed: number;
  total: number;
  populationGroups: string[];
}

const num = (s: string): number | null => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

export function FiltersPanel({ filters: f, onChange, shown, analysed, total, populationGroups }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  return (
    <section className="filters" aria-label="Filters">
      <div className="filters-head">
        <h2>Filters</h2>
        {!isDefaultFilters(f) && (
          <button type="button" className="link" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </button>
        )}
      </div>
      <p className="filter-count" aria-live="polite">
        <strong>{shown.toLocaleString()}</strong> of {analysed.toLocaleString()} analysed localities shown
        <span className="muted"> ({(total - analysed).toLocaleString()} more excluded for data reasons — see Data quality)</span>
      </p>

      <fieldset>
        <legend>2022 political balance (blue–red localities)</legend>
        <div className="range-row">
          <input type="range" min={-1} max={1} step={0.05} value={f.balanceRange[0]} aria-label="Minimum balance" onChange={(e) => set({ balanceRange: [Math.min(Number(e.target.value), f.balanceRange[1]), f.balanceRange[1]] })} />
          <input type="range" min={-1} max={1} step={0.05} value={f.balanceRange[1]} aria-label="Maximum balance" onChange={(e) => set({ balanceRange: [f.balanceRange[0], Math.max(Number(e.target.value), f.balanceRange[0])] })} />
        </div>
        <div className="muted small">
          {f.balanceRange[0].toFixed(2)} to {f.balanceRange[1].toFixed(2)}
        </div>
      </fieldset>

      <fieldset>
        <legend>Turnout change (pp)</legend>
        <div className="pair">
          <input type="number" placeholder="min" step={0.5} value={f.changeMin ?? ""} aria-label="Minimum turnout change" onChange={(e) => set({ changeMin: num(e.target.value) })} />
          <span>to</span>
          <input type="number" placeholder="max" step={0.5} value={f.changeMax ?? ""} aria-label="Maximum turnout change" onChange={(e) => set({ changeMax: num(e.target.value) })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Include</legend>
        <label className="check">
          <input type="checkbox" checked={f.includeGray} onChange={(e) => set({ includeGray: e.target.checked })} /> Arab-party plurality (gray) localities
        </label>
        <label className="check">
          <input type="checkbox" checked={f.includePreliminaryFeed} onChange={(e) => set({ includePreliminaryFeed: e.target.checked })} /> Localities using preliminary 22:00 feed figures for uncounted 2026 boxes
        </label>
      </fieldset>

      <fieldset>
        <legend>Minimum eligible voters (2022)</legend>
        <select value={f.minEligible} onChange={(e) => set({ minEligible: Number(e.target.value) })}>
          {[0, 200, 500, 1000, 5000, 20000, 50000].map((v) => (
            <option key={v} value={v}>{v === 0 ? "Any size" : `≥ ${v.toLocaleString()}`}</option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend>Minimum 2026 coverage of the electorate</legend>
        <select value={f.minCoverage2026} onChange={(e) => set({ minCoverage2026: Number(e.target.value) })}>
          {[0, 0.5, 0.9, 0.98, 1].map((v) => (
            <option key={v} value={v}>{v === 0 ? "Any" : v === 1 ? "Complete only (100%)" : `≥ ${Math.round(v * 100)}%`}</option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend>CBS locality population group</legend>
        <div className="chips">
          {populationGroups.map((g) => {
            const on = f.populationGroups.includes(g);
            return (
              <button
                type="button"
                key={g}
                className={`chip ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => set({ populationGroups: on ? f.populationGroups.filter((x) => x !== g) : [...f.populationGroups, g] })}
              >
                {POPULATION_GROUP_EN[g] ?? (g || "Unknown")}
              </button>
            );
          })}
        </div>
        <div className="muted small">None selected = all. From the CBS 2019 statistical-areas layer; localities without a polygon have no value.</div>
      </fieldset>
    </section>
  );
}
