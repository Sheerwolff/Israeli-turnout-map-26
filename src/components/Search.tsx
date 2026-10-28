import { useMemo, useState } from "react";
import type { LocalityRecord } from "../lib/types";

interface Props {
  localities: LocalityRecord[];
  onPick: (code: number) => void;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-–־'"`׳״()*.]/g, "")
    .replace(/[֑-ׇ]/g, ""); // Hebrew niqqud

export function Search({ localities, onPick }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const index = useMemo(() => localities.map((l) => ({ l, keys: [l.name_he, l.name_en ?? "", ...l.names, String(l.code)].map(norm) })), [localities]);
  const results = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    const starts: LocalityRecord[] = [];
    const contains: LocalityRecord[] = [];
    for (const { l, keys } of index) {
      if (keys.some((k) => k.startsWith(n))) starts.push(l);
      else if (keys.some((k) => k.includes(n))) contains.push(l);
    }
    const byElig = (a: LocalityRecord, b: LocalityRecord) => (b.y2022?.eligible ?? 0) - (a.y2022?.eligible ?? 0);
    return [...starts.sort(byElig), ...contains.sort(byElig)].slice(0, 10);
  }, [q, index]);

  const pick = (l: LocalityRecord) => {
    onPick(l.code);
    setQ("");
  };

  return (
    <div className="search">
      <label htmlFor="search" className="sr-only">Search localities</label>
      <input
        id="search"
        type="search"
        placeholder="Search a locality — עברית / English"
        value={q}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && results[active]) pick(results[active]);
          else if (e.key === "Escape") setQ("");
        }}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="search-results"
      />
      {results.length > 0 && (
        <ul id="search-results" role="listbox" className="search-results">
          {results.map((l, i) => (
            <li key={l.code} role="option" aria-selected={i === active} className={i === active ? "active" : ""} onMouseDown={() => pick(l)}>
              <span dir="rtl">{l.name_he}</span>
              {l.name_en && <span className="muted"> · {l.name_en}</span>}
              {!l.hasGeometry && <span className="tag">not on map</span>}
              {!l.analysed && <span className="tag">excluded</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
