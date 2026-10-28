import { useMemo, useState } from "react";
import type { AnalysisConfig } from "../config/analysis";
import { localityColor, type ColorResult } from "../lib/color";
import { fmtInt, fmtPct, fmtPp } from "../lib/format";
import { groupSummaries, overallSummary, TENDENCY_LABELS, TENDENCY_SHORT, type GroupSummary } from "../lib/stats";
import type { DatasetMeta, LocalityRecord } from "../lib/types";

interface Props {
  shown: LocalityRecord[];
  excludedCount: number;
  filteredOut: number;
  meta: DatasetMeta;
  cfg: AnalysisConfig;
  colors: Map<number, ColorResult>;
  hovered: number | null;
  onHover: (code: number | null) => void;
  onSelect: (code: number) => void;
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : "—");

export function Dashboard({ shown, excludedCount, filteredOut, meta, cfg, colors, hovered, onHover, onSelect }: Props) {
  const s = useMemo(() => overallSummary(shown, cfg), [shown, cfg]);
  const groups = useMemo(() => groupSummaries(shown, cfg), [shown, cfg]);
  const n = meta.national;
  return (
    <div className="dashboard">
      <p className="question">Did turnout change differently across localities with different 2022 political compositions?</p>

      <section>
        <h3>A. Overall turnout change <span className="muted">({s.analysed.toLocaleString()} localities)</span></h3>
        <div className="tiles">
          <Tile label="Mean change, unweighted" value={fmtPp(s.meanChangePp)} note="Each locality counts once, whatever its size." />
          <Tile label="Median change, unweighted" value={fmtPp(s.medianChangePp)} />
          <Tile label="Voter-weighted change" value={fmtPp(s.aggregateChangePp)} note={`Σvotes ÷ Σeligible of these localities: ${fmtPct(s.aggregate2022Pct)} → ${fmtPct(s.aggregate2026Pct)}`} />
        </div>
        <table className="data compact">
          <tbody>
            <tr><th>Turnout increased (≥ +{cfg.unchangedThresholdPp} pp)</th><td>{fmtInt(s.increased)}</td><td>{pct(s.increased, s.analysed)}</td></tr>
            <tr><th>Approximately unchanged (|Δ| &lt; {cfg.unchangedThresholdPp} pp)</th><td>{fmtInt(s.unchanged)}</td><td>{pct(s.unchanged, s.analysed)}</td></tr>
            <tr><th>Turnout decreased (≤ −{cfg.unchangedThresholdPp} pp)</th><td>{fmtInt(s.decreased)}</td><td>{pct(s.decreased, s.analysed)}</td></tr>
            <tr><th>Hidden by current filters</th><td>{fmtInt(filteredOut)}</td><td /></tr>
            <tr><th>Excluded (missing or invalid data)</th><td>{fmtInt(excludedCount)}</td><td /></tr>
          </tbody>
        </table>
        <p className="small muted">
          Neither figure is the national turnout change. National reference (locality-attributed votes only, excluding double envelopes): 2022 {fmtPct(n.y2022.localityTurnoutPct)}, 2026 {fmtPct(n.y2026.localityTurnoutPct)} so far. The official 2022 national turnout including double envelopes was {fmtPct(n.y2022.officialTurnoutPct, 2)}; the 2026 equivalent is not available until the count, including double envelopes, is final.
        </p>
      </section>

      <section>
        <h3>B. Turnout change by 2022 political balance</h3>
        <Scatter shown={shown} colors={colors} hovered={hovered} onHover={onHover} onSelect={onSelect} cfg={cfg} />
        <p className="small muted">Each dot is one locality, colored as on the map; dot area ∝ 2022 eligible voters. Gray (Arab-party plurality) localities are plotted in their own strip because their balance is not used for classification. Association only — this chart does not show that political composition caused any change.</p>
      </section>

      <section>
        <h3>C. Comparison by political tendency</h3>
        <MeanMedianBars groups={groups} cfg={cfg} />
        <GroupTable groups={groups} />
        <BoxPlots groups={groups} />
        <p className="small muted">
          Groups match the map's hues: blue = anti-leaning (balance ≤ {cfg.tendency.antiMax}), purple = balanced, red = pro-leaning (≥ +{cfg.tendency.proMin}), gray = Arab-party plurality. Cut-offs are configurable in src/config/analysis.ts. Unweighted locality statistics. Differences between group averages do not show that political tendency caused the change in turnout — the groups also differ in size, demography, geography and in how complete their 2026 count is.
        </p>
      </section>

      <section>
        <h3>D. Geographic patterns</h3>
        <p className="small">Use the map to look for spatial clustering: hover a legend cell to highlight every locality with that combination, or filter by turnout change. Neighbouring localities can differ sharply — proximity does not imply political similarity, and no regional grouping is imposed.</p>
      </section>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

const GROUP_NAME: Record<string, string> = { anti: "Anti-Netanyahu", balanced: "Balanced", pro: "Pro-Netanyahu", gray: "Gray" };

/** Mean (bar from 0) and median (tick) per group on one symmetric pp axis. */
function MeanMedianBars({ groups, cfg }: { groups: GroupSummary[]; cfg: AnalysisConfig }) {
  // Group swatches use the map's hue for each group at the "no change" lightness.
  const swatch = (g: string) =>
    localityColor({ balance: g === "anti" ? -1 : g === "pro" ? 1 : 0, changePp: 0, isArabPlurality: g === "gray" }, cfg.color).hex!;
  const extent = Math.max(1, ...groups.flatMap((g) => [Math.abs(g.meanChangePp ?? 0), Math.abs(g.medianChangePp ?? 0)])) * 1.03;
  const pos = (v: number) => `${50 + (v / extent) * 50}%`;
  return (
    <figure className="mmbars">
      <figcaption>
        <strong>Turnout change by 2022 bloc</strong>
        <span className="muted small">Mean (bar) and median (tick) turnout change per group of localities, grouped by their 2022 classification only.</span>
      </figcaption>
      {groups.map((g) => {
        const mean = g.meanChangePp;
        const med = g.medianChangePp;
        return (
          <div key={g.group} className="mm-row">
            <div className="mm-head">
              <span className="mm-dot" style={{ background: swatch(g.group) }} />
              <span className="mm-name">{GROUP_NAME[g.group]}</span>
              <span className="muted small">n={g.n}</span>
              <span className="mm-val">{fmtPp(mean)}</span>
            </div>
            <div className="mm-track" title={`Mean ${fmtPp(mean)}, median ${fmtPp(med)}`}>
              {mean !== null && (
                <span
                  className="mm-bar"
                  style={{ background: swatch(g.group), left: mean >= 0 ? "50%" : pos(mean), right: mean >= 0 ? `calc(100% - ${pos(mean)})` : "50%" }}
                />
              )}
              {med !== null && <span className="mm-tick" style={{ left: pos(med) }} />}
            </div>
          </div>
        );
      })}
      <div className="mm-axis">
        <span>−{extent.toFixed(1)}</span>
        <span>0 pp</span>
        <span>+{extent.toFixed(1)}</span>
      </div>
      <p className="muted small">Gray = an Arab party was the most-voted single list in 2022, a categorical group rather than a point on the anti–pro axis. Group averages are unweighted across localities.</p>
    </figure>
  );
}

function GroupTable({ groups }: { groups: GroupSummary[] }) {
  return (
    <table className="data compact">
      <thead>
        <tr><th>Group</th><th>n</th><th>Mean</th><th>Median</th><th>IQR</th></tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.group}>
            <th>{TENDENCY_LABELS[g.group]}</th>
            <td>{g.n}</td>
            <td>{fmtPp(g.meanChangePp)}</td>
            <td>{fmtPp(g.medianChangePp)}</td>
            <td>{g.box ? `${fmtPp(g.box.q1)} … ${fmtPp(g.box.q3)}` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function niceTicks(lo: number, hi: number, count = 6): number[] {
  const span = hi - lo || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function yDomain(values: number[]): [number, number] {
  if (!values.length) return [-10, 10];
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo) * 0.05 || 1;
  return [lo - pad, hi + pad];
}

function Scatter({ shown, colors, hovered, onHover, onSelect, cfg }: { shown: LocalityRecord[]; colors: Map<number, ColorResult>; hovered: number | null; onHover: (c: number | null) => void; onSelect: (c: number) => void; cfg: AnalysisConfig }) {
  const [tip, setTip] = useState<{ x: number; y: number; r: LocalityRecord } | null>(null);
  const [zoomY, setZoomY] = useState(false);
  const W = 520, H = 300, m = { l: 44, r: 8, t: 10, b: 38 };
  const stripW = 56, gap = 16;
  const plotW = W - m.l - m.r - stripW - gap;
  const pts = shown.filter((r) => r.analysed);
  const bound = cfg.color.maxAbsChangePp;
  const [y0, y1] = zoomY ? [-bound * 1.08, bound * 1.08] : yDomain(pts.map((r) => r.turnoutChangePp!));
  const sy = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - y0) / (y1 - y0));
  const sx = (b: number) => m.l + ((b + 1) / 2) * plotW;
  const stripX = m.l + plotW + gap;
  const rad = (r: LocalityRecord) => Math.max(1.6, Math.min(9, Math.sqrt((r.y2022?.eligible ?? 0) / 400)));
  // Deterministic jitter for the gray strip.
  const jitter = (code: number) => (((code * 2654435761) >>> 0) % 1000) / 1000;
  const sorted = [...pts].sort((a, b) => (b.y2022?.eligible ?? 0) - (a.y2022?.eligible ?? 0));
  const yt = niceTicks(y0, y1);

  return (
    <div className="chart-wrap" onMouseLeave={() => { setTip(null); onHover(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Scatter plot of 2022 political balance against turnout change">
        {yt.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className={t === 0 ? "zero" : "grid"} />
            <text x={m.l - 6} y={sy(t) + 3} textAnchor="end" className="tick">{t > 0 ? `+${t}` : t}</text>
          </g>
        ))}
        {[-bound, bound].filter((b) => b > y0 && b < y1).map((b) => (
          <line key={b} x1={m.l} x2={W - m.r} y1={sy(b)} y2={sy(b)} className="bound" />
        ))}
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <text key={t} x={sx(t)} y={H - m.b + 14} textAnchor="middle" className="tick">{t > 0 ? `+${t}` : t}</text>
        ))}
        <line x1={sx(0)} x2={sx(0)} y1={m.t} y2={H - m.b} className="grid" />
        <text x={m.l} y={H - 6} className="axis-label">← anti-Netanyahu</text>
        <text x={m.l + plotW} y={H - 6} textAnchor="end" className="axis-label">pro-Netanyahu →</text>
        <text x={m.l + plotW / 2} y={H - 6} textAnchor="middle" className="axis-label">2022 balance</text>
        <text x={stripX + stripW / 2} y={H - m.b + 14} textAnchor="middle" className="tick">Arab</text>
        <text x={stripX + stripW / 2} y={H - m.b + 26} textAnchor="middle" className="tick">plurality</text>
        <rect x={stripX} y={m.t} width={stripW} height={H - m.t - m.b} className="strip" />
        <text transform={`translate(11 ${(H - m.b + m.t) / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">turnout change (pp)</text>
        {sorted.map((r) => {
          const gray = r.classification!.isArabPlurality;
          const x = gray ? stripX + 6 + jitter(r.code) * (stripW - 12) : sx(r.classification!.balance!);
          const v = r.turnoutChangePp!;
          const outside = v > y1 || v < y0;
          const y = sy(Math.max(y0, Math.min(y1, v)));
          const fill = colors.get(r.code)?.hex ?? "transparent";
          const on = hovered === r.code;
          const ev = { onMouseEnter: () => { setTip({ x, y, r }); onHover(r.code); }, onClick: () => onSelect(r.code) };
          if (outside) {
            const d = v > y1 ? `M${x - 4},${y + 4} L${x + 4},${y + 4} L${x},${y - 3} Z` : `M${x - 4},${y - 4} L${x + 4},${y - 4} L${x},${y + 3} Z`;
            return <path key={r.code} d={d} fill={fill} className={`dot ${on ? "on" : ""}`} {...ev} />;
          }
          return (
            <circle
              key={r.code}
              cx={x}
              cy={y}
              r={on ? rad(r) + 2 : rad(r)}
              fill={fill}
              className={`dot ${on ? "on" : ""}`}
              onMouseEnter={() => { setTip({ x, y, r }); onHover(r.code); }}
              onClick={() => onSelect(r.code)}
            />
          );
        })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%` }}>
          <strong dir="rtl">{tip.r.name_he}</strong>
          {tip.r.name_en && <span className="muted"> · {tip.r.name_en}</span>}
          <div>Balance {tip.r.classification!.balance === null ? "n/a" : tip.r.classification!.balance.toFixed(2)} · {fmtPp(tip.r.turnoutChangePp)}</div>
          <div className="muted">{fmtPct(tip.r.y2022!.turnoutPct)} → {fmtPct(tip.r.y2026!.turnoutPct)}</div>
        </div>
      )}
      <div className="muted small chart-foot">
        <span>Dashed lines: ±{bound} pp color-scale bound.{zoomY && " Triangles: values beyond the visible range."}</span>
        <label className="check">
          <input type="checkbox" checked={zoomY} onChange={(e) => setZoomY(e.target.checked)} /> Zoom y-axis to ±{bound} pp
        </label>
      </div>
    </div>
  );
}

function BoxPlots({ groups }: { groups: GroupSummary[] }) {
  const W = 520, rowH = 30, m = { l: 128, r: 12, t: 6, b: 26 };
  const H = m.t + groups.length * rowH + m.b;
  const all = groups.flatMap((g) => (g.box ? [g.box.min, g.box.max] : []));
  const [x0, x1] = yDomain(all);
  const sx = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const ticks = niceTicks(x0, x1, 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Box plots of turnout change by political-tendency group">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} className={t === 0 ? "zero" : "grid"} />
          <text x={sx(t)} y={H - m.b + 14} textAnchor="middle" className="tick">{t > 0 ? `+${t}` : t}</text>
        </g>
      ))}
      <text x={W - m.r} y={H - 2} textAnchor="end" className="axis-label">turnout change (pp)</text>
      {groups.map((g, i) => {
        const y = m.t + i * rowH + rowH / 2;
        const b = g.box;
        return (
          <g key={g.group}>
            <text x={m.l - 8} y={y + 4} textAnchor="end" className="tick">{TENDENCY_SHORT[g.group]} (n={g.n})</text>
            {b && (
              <g className="box">
                <title>{`${TENDENCY_LABELS[g.group]}: median ${fmtPp(b.median)}, IQR ${fmtPp(b.q1)} … ${fmtPp(b.q3)}, whiskers ${fmtPp(b.whiskerLow)} … ${fmtPp(b.whiskerHigh)}, ${b.outliers.length} outliers`}</title>
                <line x1={sx(b.whiskerLow)} x2={sx(b.whiskerHigh)} y1={y} y2={y} className="whisker" />
                <rect x={sx(b.q1)} y={y - 8} width={Math.max(1, sx(b.q3) - sx(b.q1))} height={16} rx={2} className={`iqr ${g.group}`} />
                <line x1={sx(b.median)} x2={sx(b.median)} y1={y - 8} y2={y + 8} className="median" />
                {b.outliers.map((o, k) => (
                  <circle key={k} cx={sx(o)} cy={y} r={1.8} className="outlier" />
                ))}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
