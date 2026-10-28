import { useState } from "react";
import type { ColorScaleConfig } from "../config/analysis";
import { localityColor } from "../lib/color";

export interface LegendCell {
  kind: "bloc" | "gray";
  /** Balance bin (bloc only). */
  balanceLo: number;
  balanceHi: number;
  /** Change bin in pp; outer bins are open-ended. */
  changeLo: number;
  changeHi: number;
}

interface Props {
  cfg: ColorScaleConfig;
  boundChoices: number[];
  onBoundChange: (pp: number) => void;
  onDirectionToggle: () => void;
  /** Hover / pin a cell to highlight the localities it contains. */
  onHighlight: (cell: LegendCell | null) => void;
  countFor: (cell: LegendCell) => number;
}

const COLS = 9;
const ROWS = 7;
const CELL = 22;

export function Legend({ cfg, boundChoices, onBoundChange, onDirectionToggle, onHighlight, countFor }: Props) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const max = cfg.maxAbsChangePp;
  const rowStep = (2 * max) / ROWS;
  const colStep = 2 / COLS;
  // Rows top → bottom go from the largest increase to the largest decrease.
  const rows = Array.from({ length: ROWS }, (_, i) => {
    const hi = max - i * rowStep;
    const lo = hi - rowStep;
    return { lo: i === ROWS - 1 ? -Infinity : lo, hi: i === 0 ? Infinity : hi, mid: (lo + hi) / 2 };
  });
  const cols = Array.from({ length: COLS }, (_, j) => {
    const lo = -1 + j * colStep;
    return { lo, hi: lo + colStep, mid: lo + colStep / 2 };
  });
  const darkerUp = cfg.direction === "darker_means_increase";

  const cellEvents = (cell: LegendCell, key: string, label: string) => ({
    onMouseEnter: () => {
      if (!pinned) onHighlight(cell);
      setHoverInfo(`${label}: ${countFor(cell)} localities`);
    },
    onMouseLeave: () => {
      if (!pinned) onHighlight(null);
      setHoverInfo(null);
    },
    onClick: () => {
      if (pinned === key) {
        setPinned(null);
        onHighlight(null);
      } else {
        setPinned(key);
        onHighlight(cell);
      }
    },
    style: { cursor: "pointer" },
  });

  const rangeLabel = (lo: number, hi: number) =>
    lo === -Infinity ? `≤ −${(-hi).toFixed(1)}` : hi === Infinity ? `≥ +${lo.toFixed(1)}` : `${lo >= 0 ? "+" : "−"}${Math.abs(lo).toFixed(1)} to ${hi >= 0 ? "+" : "−"}${Math.abs(hi).toFixed(1)}`;

  const W = 34 + COLS * CELL + 14 + CELL + 6;
  const H = ROWS * CELL + 34;
  return (
    <section className="legend" aria-label="Color legend">
      <h2>How to read the colors</h2>
      <p className="legend-lead">
        <strong>Hue</strong> = how the locality voted in <strong>2022</strong> (it does not change with 2026 votes).{" "}
        <strong>Lightness</strong> = change in turnout 2022→2026, in percentage points.{" "}
        <strong>{darkerUp ? "Darker = turnout rose" : "Lighter = turnout rose"}</strong>, not stronger support.
      </p>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two-dimensional legend: columns are 2022 political balance, rows are turnout change">
        {rows.map((r, i) => (
          <g key={i}>
            {cols.map((c, j) => {
              const col = localityColor({ balance: c.mid, changePp: r.mid, isArabPlurality: false }, cfg);
              const key = `b${i}-${j}`;
              const cell: LegendCell = { kind: "bloc", balanceLo: c.lo, balanceHi: c.hi, changeLo: r.lo, changeHi: r.hi };
              return (
                <rect
                  key={j}
                  x={34 + j * CELL}
                  y={i * CELL}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={2}
                  fill={col.hex!}
                  stroke={pinned === key ? "var(--ink)" : "none"}
                  strokeWidth={2}
                  {...cellEvents(cell, key, `Balance ${c.lo.toFixed(2)}…${c.hi.toFixed(2)}, change ${rangeLabel(r.lo, r.hi)} pp`)}
                />
              );
            })}
            {(() => {
              const col = localityColor({ balance: null, changePp: r.mid, isArabPlurality: true }, cfg);
              const key = `g${i}`;
              const cell: LegendCell = { kind: "gray", balanceLo: -1, balanceHi: 1, changeLo: r.lo, changeHi: r.hi };
              return <rect x={34 + COLS * CELL + 14} y={i * CELL} width={CELL - 2} height={CELL - 2} rx={2} fill={col.hex!} stroke={pinned === key ? "var(--ink)" : "none"} strokeWidth={2} {...cellEvents(cell, key, `Arab-party plurality, change ${rangeLabel(r.lo, r.hi)} pp`)} />;
            })()}
          </g>
        ))}
        <text x={30} y={9} className="tick" textAnchor="end">+{max}</text>
        <text x={30} y={(ROWS * CELL) / 2 + 3} className="tick" textAnchor="end">0</text>
        <text x={30} y={ROWS * CELL - 4} className="tick" textAnchor="end">−{max}</text>
        <text x={34} y={ROWS * CELL + 12} className="tick">−1</text>
        <text x={34 + (COLS * CELL) / 2} y={ROWS * CELL + 12} className="tick" textAnchor="middle">0</text>
        <text x={34 + COLS * CELL - 2} y={ROWS * CELL + 12} className="tick" textAnchor="end">+1</text>
        <text x={34} y={ROWS * CELL + 27} className="axis-label">← anti-Netanyahu</text>
        <text x={34 + COLS * CELL - 2} y={ROWS * CELL + 27} className="axis-label" textAnchor="end">pro-Netanyahu →</text>
        <text x={34 + COLS * CELL + 14 + CELL / 2} y={ROWS * CELL + 12} className="tick" textAnchor="middle">Arab</text>
      </svg>
      <div className="legend-hover" aria-live="polite">{hoverInfo ?? (pinned ? "Click the cell again to clear the highlight." : "Hover or click a cell to highlight those localities.")}</div>
      <ul className="legend-notes">
        <li><span className="axis-chip">rows</span> turnout change (pp), ±{max} pp scale; outer rows include everything beyond it.</li>
        <li><span className="axis-chip">columns</span> 2022 political balance = (pro − anti) ÷ (pro + anti).</li>
        <li><span className="swatch gray" /> Gray column: an Arab party was the single most-voted-for party in 2022. Same turnout lightness scale.</li>
        <li><span className="swatch dotted" /> Dotted outline: change beyond ±{max} pp (color clipped, true value in tooltip).</li>
        <li><span className="swatch dashed" /> Dashed outline: 2026 data cover &lt; 98% of the electorate.</li>
        <li><span className="swatch hatch" /> Hatched: excluded (missing/invalid data or no bloc balance).</li>
        <li><span className="swatch outline" /> Outline only: no election data, or hidden by filters.</li>
      </ul>
      <div className="legend-controls">
        <label>
          Scale bound
          <select value={max} onChange={(e) => onBoundChange(Number(e.target.value))}>
            {[...new Set([...boundChoices, max])].sort((a, b) => a - b).map((b) => (
              <option key={b} value={b}>±{b} pp</option>
            ))}
          </select>
        </label>
        <button type="button" className="link" onClick={onDirectionToggle}>
          Flip lightness direction
        </button>
      </div>
    </section>
  );
}
