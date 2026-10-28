// Minimal RFC 4180 CSV parser (quoted fields, "" escapes, CRLF), enough for
// CEC exports. Returns rows as arrays of strings; the first row is the header.

export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Parses CSV into objects keyed by trimmed header names; empty trailing header columns are dropped. */
export function parseCsvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [rawHeader, ...rows] = parseCsv(text);
  if (!rawHeader) return { header: [], records: [] };
  const header = rawHeader.map((h) => h.trim());
  const records = rows.map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
  return { header: header.filter(Boolean), records };
}

/** Normalises a ballot-box identifier ("1", "1.0", "576.10") so the same box matches across files. */
export function boxKey(code: number, box: string): string {
  const n = Number(box);
  return `${code}:${Number.isFinite(n) ? String(n) : box.trim()}`;
}
