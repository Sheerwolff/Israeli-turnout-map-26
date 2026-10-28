import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { ColorResult } from "../lib/color";
import type { LocalityRecord } from "../lib/types";

export type Bounds = [[number, number], [number, number]];
export const ISRAEL_BOUNDS: Bounds = [[34.2, 29.45], [35.95, 33.35]];

export interface GeometryCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; id: number; properties: { code: number }; geometry: GeoJSON.Geometry }[];
}

interface Props {
  geometry: GeometryCollection;
  records: Map<number, LocalityRecord>;
  colors: Map<number, ColorResult>;
  passing: Set<number>;
  /** When set, only these codes are emphasised (legend hover); others are dimmed. */
  highlight: Set<number> | null;
  selected: number | null;
  hovered: number | null;
  basemap: boolean;
  dark: boolean;
  flyTo: { bounds: Bounds; key: number } | null;
  onHover: (code: number | null, point: { x: number; y: number } | null) => void;
  onSelect: (code: number | null) => void;
}

type State = "colored" | "uncolored" | "filtered" | "excluded" | "no_election";

function buildFeatures(p: Props) {
  return {
    type: "FeatureCollection" as const,
    features: p.geometry.features.map((f) => {
      const r = p.records.get(f.id);
      const c = p.colors.get(f.id);
      let state: State;
      if (!r) state = "no_election";
      else if (!r.analysed) state = "excluded";
      else if (!p.passing.has(f.id)) state = "filtered";
      else state = c?.hex ? "colored" : "uncolored";
      return {
        ...f,
        properties: {
          code: f.id,
          fill: state === "colored" ? c!.hex! : "",
          state,
          clipped: state === "colored" && !!c?.clipped,
          partial: !!r && state === "colored" && r.warnings.includes("partial_2026_coverage"),
          dim: !!p.highlight && !p.highlight.has(f.id),
        },
      };
    }),
  };
}

function hatchPattern(dark: boolean): ImageData {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4);
  const ink = dark ? [200, 200, 200] : [90, 90, 90];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const on = (x + y) % size === 0 || (x + y) % size === size - 1;
      const i = (y * size + x) * 4;
      data.set([...ink, on ? 150 : 0], i);
    }
  return new ImageData(data, size, size);
}

/** Set VITE_BASEMAP=off for hosts that block third-party tiles; the polygons then sit on a plain background. */
export const BASEMAP_AVAILABLE = import.meta.env.VITE_BASEMAP !== "off";

const tiles = (style: string) => ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`);

export function MapView(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const loaded = useRef(false);
  const prevSel = useRef<number | null>(null);
  const prevHover = useRef<number | null>(null);

  useEffect(() => {
    const dark = props.dark;
    const map = new maplibregl.Map({
      container: ref.current!,
      bounds: ISRAEL_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      minZoom: 5.5,
      maxZoom: 15,
      attributionControl: false,
      style: {
        version: 8,
        sources: BASEMAP_AVAILABLE
          ? {
              base: { type: "raster", tiles: tiles(dark ? "dark_nolabels" : "light_nolabels"), tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" },
              labels: { type: "raster", tiles: tiles(dark ? "dark_only_labels" : "light_only_labels"), tileSize: 256 },
            }
          : {},
        layers: [
          { id: "bg", type: "background", paint: { "background-color": dark ? "#1b1d22" : "#f4f4f1" } },
          ...(BASEMAP_AVAILABLE ? [{ id: "base", type: "raster" as const, source: "base", paint: { "raster-opacity": 0.85 } }] : []),
        ],
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Boundaries: CBS · Results: CEC" }));
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.addImage("hatch", hatchPattern(dark), { pixelRatio: 2 });
      map.addSource("loc", { type: "geojson", data: buildFeatures(propsRef.current), promoteId: "code" });
      const line = dark ? "rgba(230,230,230,0.35)" : "rgba(40,40,40,0.35)";
      map.addLayer({
        id: "loc-fill",
        type: "fill",
        source: "loc",
        filter: ["==", ["get", "state"], "colored"],
        paint: { "fill-color": ["get", "fill"], "fill-opacity": ["case", ["get", "dim"], 0.12, 0.95] },
      });
      map.addLayer({ id: "loc-hatch", type: "fill", source: "loc", filter: ["in", ["get", "state"], ["literal", ["excluded", "uncolored"]]], paint: { "fill-pattern": "hatch", "fill-opacity": 0.9 } });
      map.addLayer({ id: "loc-filtered", type: "fill", source: "loc", filter: ["==", ["get", "state"], "filtered"], paint: { "fill-color": dark ? "#555" : "#bbb", "fill-opacity": 0.12 } });
      map.addLayer({ id: "loc-line", type: "line", source: "loc", paint: { "line-color": line, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 10, 0.8, 13, 1.4] } });
      map.addLayer({
        id: "loc-noelection",
        type: "line",
        source: "loc",
        filter: ["==", ["get", "state"], "no_election"],
        paint: { "line-color": line, "line-width": 0.6, "line-dasharray": [1, 2] },
      });
      map.addLayer({
        id: "loc-partial",
        type: "line",
        source: "loc",
        filter: ["all", ["get", "partial"], ["!", ["get", "dim"]]],
        paint: { "line-color": dark ? "#f0f0f0" : "#222", "line-width": 1.2, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "loc-clipped",
        type: "line",
        source: "loc",
        filter: ["all", ["get", "clipped"], ["!", ["get", "dim"]]],
        paint: { "line-color": dark ? "#ffffff" : "#000000", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 11, 1.6], "line-dasharray": [0.6, 1.2] },
      });
      map.addLayer({
        id: "loc-active",
        type: "line",
        source: "loc",
        paint: {
          "line-color": dark ? "#ffffff" : "#000000",
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, ["boolean", ["feature-state", "hover"], false], 2, 0],
        },
      });
      if (BASEMAP_AVAILABLE) map.addLayer({ id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } });
      loaded.current = true;
      syncAll();
    });

    const hit = ["loc-fill", "loc-hatch", "loc-filtered"];
    map.on("mousemove", (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: hit })[0];
      const code = f ? Number(f.properties!.code) : null;
      map.getCanvas().style.cursor = code !== null ? "pointer" : "";
      propsRef.current.onHover(code, code !== null ? { x: e.point.x, y: e.point.y } : null);
    });
    map.on("mouseout", () => propsRef.current.onHover(null, null));
    map.on("click", (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: hit })[0];
      propsRef.current.onSelect(f ? Number(f.properties!.code) : null);
    });

    function syncAll() {
      (map.getSource("loc") as GeoJSONSource).setData(buildFeatures(propsRef.current));
      if (BASEMAP_AVAILABLE) {
        map.setLayoutProperty("base", "visibility", propsRef.current.basemap ? "visible" : "none");
        map.setLayoutProperty("labels", "visibility", propsRef.current.basemap ? "visible" : "none");
      }
    }
    (map as unknown as { __sync: () => void }).__sync = syncAll;
    return () => {
      loaded.current = false;
      map.remove();
    };
    // Recreate only when the theme changes (tile style and line ink differ).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dark]);

  useEffect(() => {
    const map = mapRef.current as (MlMap & { __sync?: () => void }) | null;
    if (map && loaded.current) map.__sync?.();
  }, [props.colors, props.passing, props.highlight, props.records, props.basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const set = (code: number | null, key: string, value: boolean) => code !== null && map.setFeatureState({ source: "loc", id: code }, { [key]: value });
    set(prevSel.current, "selected", false);
    set(props.selected, "selected", true);
    prevSel.current = props.selected;
    set(prevHover.current, "hover", false);
    set(props.hovered, "hover", true);
    prevHover.current = props.hovered;
  }, [props.selected, props.hovered, props.colors, props.passing]);

  useEffect(() => {
    if (props.flyTo && mapRef.current) mapRef.current.fitBounds(props.flyTo.bounds, { padding: 60, maxZoom: 13, duration: 800 });
  }, [props.flyTo]);

  return <div ref={ref} className="map" role="application" aria-label="Map of Israeli localities colored by 2022 political balance and 2022–2026 turnout change" />;
}
