import { useCallback, useEffect, useMemo, useState } from "react";
import { ANALYSIS_CONFIG, type AnalysisConfig } from "./config/analysis";
import { localityColor, type ColorResult } from "./lib/color";
import { DEFAULT_FILTERS, passesFilters, type Filters } from "./lib/filters";
import { tendencyGroup } from "./lib/stats";
import type { Dataset, LocalityRecord, PartyDef } from "./lib/types";
import { Dashboard } from "./components/Dashboard";
import { FiltersPanel } from "./components/FiltersPanel";
import { Legend, type LegendCell } from "./components/Legend";
import { DetailPanel, TooltipContent } from "./components/LocalityInfo";
import { BASEMAP_AVAILABLE, ISRAEL_BOUNDS, MapView, type Bounds, type GeometryCollection } from "./components/MapView";
import { MethodPanel } from "./components/MethodPanel";
import { QualityPanel } from "./components/QualityPanel";
import { Search } from "./components/Search";

type Tab = "dashboard" | "locality" | "quality" | "method";

function bboxOf(geom: GeoJSON.Geometry): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk((geom as { coordinates: unknown }).coordinates);
  return [[x0, y0], [x1, y1]];
}

export function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [geometry, setGeometry] = useState<GeometryCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<AnalysisConfig>(ANALYSIS_CONFIG);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mapHover, setMapHover] = useState<{ code: number; x: number; y: number } | null>(null);
  const [legendCell, setLegendCell] = useState<LegendCell | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [basemap, setBasemap] = useState(true);
  const [flyTo, setFlyTo] = useState<{ bounds: Bounds; key: number } | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([fetch(`${base}data/dataset.json`).then((r) => r.json()), fetch(`${base}data/geometry.geojson`).then((r) => r.json())])
      .then(([d, g]) => {
        setDataset(d);
        setGeometry(g);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const byCode = useMemo(() => new Map((dataset?.localities ?? []).map((l) => [l.code, l])), [dataset]);
  const parties = useMemo(() => new Map<string, PartyDef>((dataset?.parties ?? []).map((p) => [p.letter, p])), [dataset]);
  const bounds = useMemo(() => new Map((geometry?.features ?? []).map((f) => [f.id, bboxOf(f.geometry)])), [geometry]);

  const colors = useMemo(() => {
    const m = new Map<number, ColorResult>();
    for (const l of dataset?.localities ?? []) {
      m.set(l.code, localityColor({ balance: l.classification?.balance ?? null, changePp: l.turnoutChangePp, isArabPlurality: !!l.classification?.isArabPlurality }, cfg.color));
    }
    return m;
  }, [dataset, cfg.color]);

  const shown = useMemo(() => (dataset?.localities ?? []).filter((l) => passesFilters(l, filters)), [dataset, filters]);
  const passing = useMemo(() => new Set(shown.map((l) => l.code)), [shown]);
  const analysedCount = useMemo(() => (dataset?.localities ?? []).filter((l) => l.analysed).length, [dataset]);

  const inCell = useCallback((l: LocalityRecord, cell: LegendCell) => {
    const c = l.classification;
    if (!c || l.turnoutChangePp === null) return false;
    if (l.turnoutChangePp < cell.changeLo || l.turnoutChangePp >= cell.changeHi) return false;
    if (cell.kind === "gray") return c.isArabPlurality;
    if (c.isArabPlurality || c.balance === null) return false;
    if (cell.group) return tendencyGroup(l, cfg.tendency) === cell.group;
    return c.balance >= cell.balanceLo && (c.balance < cell.balanceHi || (cell.balanceHi >= 1 && c.balance <= 1));
  }, [cfg.tendency]);
  const highlight = useMemo(() => (legendCell ? new Set(shown.filter((l) => inCell(l, legendCell)).map((l) => l.code)) : null), [legendCell, shown, inCell]);
  const countFor = useCallback((cell: LegendCell) => shown.filter((l) => inCell(l, cell)).length, [shown, inCell]);

  const gradient = useMemo(() => {
    const at = (b: number) => localityColor({ balance: b, changePp: 0, isArabPlurality: false }, cfg.color).hex;
    if (cfg.color.hueMode === "categorical") {
      // Hard stops at the category cut-offs, positioned on the −1…+1 gauge.
      const pos = (b: number) => `${((b + 1) / 2) * 100}%`;
      const { antiMax, proMin } = cfg.color.categories;
      return `linear-gradient(to right, ${at(-1)} 0 ${pos(antiMax)}, ${at(0)} ${pos(antiMax)} ${pos(proMin)}, ${at(1)} ${pos(proMin)} 100%)`;
    }
    return `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) => at(-1 + i * 0.2)).join(", ")})`;
  }, [cfg.color]);

  const select = useCallback(
    (code: number | null, zoom = false) => {
      setSelected(code);
      if (code !== null) {
        setTab("locality");
        const b = bounds.get(code);
        if (zoom && b) setFlyTo({ bounds: b, key: Date.now() });
      }
    },
    [bounds],
  );

  if (error) return <div className="loading">Could not load data: {error}</div>;
  if (!dataset || !geometry) return <div className="loading">Loading election data…</div>;

  const sel = selected !== null ? byCode.get(selected) ?? null : null;
  const hoverRec = mapHover ? byCode.get(mapHover.code) : undefined;
  const meta = dataset.meta;
  const popGroups = [...new Set(dataset.localities.map((l) => l.populationGroup).filter((g): g is string => !!g))].sort();

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Israel: 2022 political composition × turnout change 2022→2026</h1>
          <p className="sub">Locality-level explorer. Hue = 2022 vote balance; lightness = change in turnout (percentage points).</p>
        </div>
        <div className={`mode mode-${meta.mode}`} role="status">
          {meta.mode === "mock" ? "MOCK DATA — not real election results" : meta.mode === "official_partial" ? (meta.primary2026 === "feed" ? "2026: election-day turnout report (not final)" : "2026: full CEC count, not yet certified") : "Official final results"}
        </div>
      </header>

      <aside className="side">
        <Search localities={dataset.localities} onPick={(c) => select(c, true)} />
        <Legend
          cfg={cfg.color}
          boundChoices={cfg.scaleBoundChoices}
          onBoundChange={(pp) => setCfg({ ...cfg, color: { ...cfg.color, maxAbsChangePp: pp } })}
          onDirectionToggle={() => setCfg({ ...cfg, color: { ...cfg.color, direction: cfg.color.direction === "darker_means_increase" ? "lighter_means_increase" : "darker_means_increase" } })}
          onHighlight={setLegendCell}
          countFor={countFor}
        />
        <FiltersPanel primary2026={meta.primary2026} filters={filters} onChange={setFilters} shown={shown.length} analysed={analysedCount} total={dataset.localities.length} populationGroups={popGroups} />
      </aside>

      <main className="map-wrap">
        <MapView
          geometry={geometry}
          records={byCode}
          colors={colors}
          passing={passing}
          highlight={highlight}
          selected={selected}
          hovered={hovered ?? mapHover?.code ?? null}
          basemap={basemap}
          dark={false}
          flyTo={flyTo}
          onHover={(code, pt) => setMapHover(code !== null && pt ? { code, ...pt } : null)}
          onSelect={(c) => select(c)}
        />
        <div className="map-tools">
          <button type="button" onClick={() => setFlyTo({ bounds: ISRAEL_BOUNDS, key: Date.now() })}>Fit Israel</button>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setLegendCell(null);
              setFilters(DEFAULT_FILTERS);
              setFlyTo({ bounds: ISRAEL_BOUNDS, key: Date.now() });
            }}
          >
            Reset view
          </button>
          {BASEMAP_AVAILABLE && (
            <label className="check">
              <input type="checkbox" checked={basemap} onChange={(e) => setBasemap(e.target.checked)} /> Basemap
            </label>
          )}
        </div>
        {mapHover && hoverRec && (
          <div className="tooltip" style={{ left: mapHover.x + 14, top: mapHover.y + 14 }}>
            <TooltipContent r={hoverRec} color={colors.get(hoverRec.code)} parties={parties} />
          </div>
        )}
      </main>

      <section className="panel">
        <nav className="tabs" role="tablist">
          {(["dashboard", "locality", "quality", "method"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "dashboard" ? "Dashboard" : t === "locality" ? "Locality" : t === "quality" ? "Data quality" : "Method"}
            </button>
          ))}
        </nav>
        <div className="panel-body">
          {tab === "dashboard" && (
            <Dashboard
              shown={shown}
              excludedCount={dataset.localities.length - analysedCount}
              filteredOut={analysedCount - shown.length}
              meta={meta}
              cfg={cfg}
              colors={colors}
              hovered={hovered ?? mapHover?.code ?? null}
              onHover={setHovered}
              onSelect={(c) => select(c, true)}
            />
          )}
          {tab === "locality" &&
            (sel ? (
              <DetailPanel r={sel} color={colors.get(sel.code)} parties={parties} gradient={gradient} onClose={() => setSelected(null)} />
            ) : (
              <p className="muted">Click a locality on the map, a dot in the scatter plot, or use search.</p>
            ))}
          {tab === "quality" && <QualityPanel dataset={dataset} byCode={byCode} onSelect={(c) => select(c, true)} />}
          {tab === "method" && <MethodPanel dataset={dataset} cfg={cfg} />}
        </div>
      </section>
    </div>
  );
}
