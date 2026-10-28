import { useState } from "react";
import type { TendencyGroup } from "../lib/stats";
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
  /** Set in categorical mode: the cell holds this tendency group. */
  group?: TendencyGroup;
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

const CONTINUOUS_COLS = 9;
const ROWS = 9;
const CELL = 22;

export function Legend({ cfg, boundChoices, onBoundChange, onDirectionToggle, onHighlight, countFor }: Props) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const max = cfg.maxAbsChangePp;
  const rowStep = (2 * max) / ROWS;
  const categorical = cfg.hueMode === "categorical";
  const cut = cfg.categories;
  // Rows top → bottom go from the largest increase to the largest decrease.
  const rows = Array.from({ length: ROWS }, (_, i) => {
    const hi = max - i * rowStep;
    const lo = hi - rowStep;
    return { lo: i === ROWS - 1 ? -Infinity : lo, hi: i === 0 ? Infinity : hi, mid: (lo + hi) / 2 };
  });
  const cols: { lo: number; hi: number; mid: number; group?: TendencyGroup; label: string }[] = categorical
    ? [
        { lo: -1, hi: cut.antiMax, mid: -1, group: "anti", label: `Anti-leaning (balance ≤ ${cut.antiMax})` },
        { lo: cut.antiMax, hi: cut.proMin, mid: (cut.antiMax + cut.proMin) / 2, group: "balanced", label: `Balanced (${cut.antiMax} to +${cut.proMin})` },
        { lo: cut.proMin, hi: 1, mid: 1, group: "pro", label: `Pro-leaning (balance ≥ +${cut.proMin})` },
      ]
    : Array.from({ length: CONTINUOUS_COLS }, (_, j) => {
        const step = 2 / CONTINUOUS_COLS;
        const lo = -1 + j * step;
        return { lo, hi: lo + step, mid: lo + step / 2, label: `Balance ${lo.toFixed(2)}…${(lo + step).toFixed(2)}` };
      });
  const COLS = cols.length;
  const CELL_W = categorical ? 44 : CELL;
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

  const X0 = 34;
  const GRAY_X = X0 + COLS * CELL_W + 14;
  const W = GRAY_X + CELL_W + 6;
  const H = ROWS * CELL + (categorical ? 30 : 32);
  return (
    <section className="legend" aria-label="Color legend">
      <h2>How to read the colors</h2>
      <p className="legend-lead">
        <strong>Hue</strong> = how the locality voted in <strong>2022</strong> (it does not change with 2026 votes).{" "}
        <strong>Lightness</strong> = change in turnout 2022→2026, in percentage points.{" "}
        <strong>{darkerUp ? "Darker = turnout rose" : "Lighter = turnout rose"}</strong>, not stronger support.
      </p>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Two-dimensional legend: columns are 2022 ${categorical ? "political-tendency categories" : "political balance"}, rows are turnout change`}>
        {rows.map((r, i) => (
          <g key={i}>
            {cols.map((c, j) => {
              const col = localityColor({ balance: c.mid, changePp: r.mid, isArabPlurality: false }, cfg);
              const key = `b${i}-${j}`;
              const cell: LegendCell = { kind: "bloc", balanceLo: c.lo, balanceHi: c.hi, changeLo: r.lo, changeHi: r.hi, group: c.group };
              return (
                <rect
                  key={j}
                  x={X0 + j * CELL_W}
                  y={i * CELL}
                  width={CELL_W - 2}
                  height={CELL - 2}
                  rx={2}
                  fill={col.hex!}
                  stroke={pinned === key ? "var(--ink)" : "none"}
                  strokeWidth={2}
                  {...cellEvents(cell, key, `${c.label}, change ${rangeLabel(r.lo, r.hi)} pp`)}
                />
              );
            })}
            {(() => {
              const col = localityColor({ balance: null, changePp: r.mid, isArabPlurality: true }, cfg);
              const key = `g${i}`;
              const cell: LegendCell = { kind: "gray", balanceLo: -1, balanceHi: 1, changeLo: r.lo, changeHi: r.hi };
              return <rect x={GRAY_X} y={i * CELL} width={CELL_W - 2} height={CELL - 2} rx={2} fill={col.hex!} stroke={pinned === key ? "var(--ink)" : "none"} strokeWidth={2} {...cellEvents(cell, key, `Arab-party plurality, change ${rangeLabel(r.lo, r.hi)} pp`)} />;
            })()}
          </g>
        ))}
        <text x={X0 - 4} y={9} className="tick" textAnchor="end">+{max}</text>
        <text x={X0 - 4} y={(ROWS * CELL) / 2 + 3} className="tick" textAnchor="end">0</text>
        <text x={X0 - 4} y={ROWS * CELL - 4} className="tick" textAnchor="end">−{max}</text>
        {categorical ? (
          <>
            {["Anti", "Balanced", "Pro"].map((t, j) => (
              <text key={t} x={X0 + j * CELL_W + (CELL_W - 2) / 2} y={ROWS * CELL + 12} className="tick" textAnchor="middle">{t}</text>
            ))}
            <text x={X0 + CELL_W - 1} y={ROWS * CELL + 25} className="tick" textAnchor="middle">{cut.antiMax}</text>
            <text x={X0 + 2 * CELL_W - 1} y={ROWS * CELL + 25} className="tick" textAnchor="middle">+{cut.proMin}</text>
          </>
        ) : (
          <>
            <text x={X0} y={ROWS * CELL + 12} className="tick">−1</text>
            <text x={X0 + (COLS * CELL_W) / 2} y={ROWS * CELL + 12} className="tick" textAnchor="middle">0</text>
            <text x={X0 + COLS * CELL_W - 2} y={ROWS * CELL + 12} className="tick" textAnchor="end">+1</text>
          </>
        )}
        {!categorical && (
          <>
            <text x={X0} y={ROWS * CELL + 27} className="axis-label">← anti-Netanyahu</text>
            <text x={X0 + COLS * CELL_W - 2} y={ROWS * CELL + 27} className="axis-label" textAnchor="end">pro-Netanyahu →</text>
          </>
        )}
        <text x={GRAY_X + (CELL_W - 2) / 2} y={ROWS * CELL + 12} className="tick" textAnchor="middle">Arab</text>
      </svg>
      <div className="legend-hover" aria-live="polite">{hoverInfo ?? (pinned ? "Click the cell again to clear the highlight." : "Hover or click a cell to highlight those localities.")}</div>
      <ul className="legend-notes">
        <li><span className="axis-chip">rows</span> turnout change (pp), ±{max} pp scale; outer rows include everything beyond it.</li>
        <li>
          <span className="axis-chip">columns</span>
          {categorical
            ? `2022 political balance = (pro − anti) ÷ (pro + anti): blue ≤ ${cut.antiMax}, purple between, red ≥ +${cut.proMin}.`
            : "2022 political balance = (pro − anti) ÷ (pro + anti), continuous."}
        </li>
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
