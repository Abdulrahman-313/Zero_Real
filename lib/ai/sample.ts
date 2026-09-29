import { MAX_SAMPLE_ROWS } from "./schemas";

export interface ParsedSample {
  headers: string[];
  /** Cell values as strings; missing values are null. */
  rows: Array<Array<string | null>>;
  format: "csv" | "json";
}

/** Minimal RFC 4180 parser (quotes, escaped quotes, CRLF, embedded newlines). Auto-detects , ; or tab. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Parses a pasted CSV or JSON (array of objects) sample. Throws an Error with a
 * user-facing message when the sample is empty or malformed.
 */
export function parseSample(text: string): ParsedSample {
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("Paste a small CSV or JSON sample first.");

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error("That looks like JSON but could not be parsed. Check for missing commas or quotes.");
    }
    const list = Array.isArray(data) ? data : [data];
    const records = list.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r));
    if (records.length === 0) throw new Error("JSON samples must be an array of objects, e.g. [{\"id\": 1, \"name\": \"Ada\"}].");
    const headers: string[] = [];
    for (const r of records.slice(0, MAX_SAMPLE_ROWS)) for (const k of Object.keys(r)) if (!headers.includes(k)) headers.push(k);
    if (headers.length === 0) throw new Error("The JSON objects have no fields.");
    const rows = records.slice(0, MAX_SAMPLE_ROWS).map((r) => headers.map((h) => cellToString(r[h])));
    return { headers: headers.slice(0, 40), rows: rows.map((r) => r.slice(0, 40)), format: "json" };
  }

  const table = parseCsv(trimmed);
  if (table.length < 2) throw new Error("A CSV sample needs a header row and at least one data row.");
  const headers = table[0].map((h, i) => h.trim() || `column_${i + 1}`).slice(0, 40);
  const rows = table.slice(1, MAX_SAMPLE_ROWS + 1).map((r) => headers.map((_, i) => {
    const v = r[i];
    return v === undefined || v.trim() === "" || /^(null|na|n\/a|none)$/i.test(v.trim()) ? null : v;
  }));
  return { headers, rows, format: "csv" };
}

/** Compact CSV rendering of the sample for prompts (cells truncated). */
export function sampleToPromptCsv(sample: ParsedSample, maxRows = 20, maxCell = 60): string {
  const esc = (v: string | null) => {
    if (v === null) return "";
    const s = v.length > maxCell ? `${v.slice(0, maxCell)}…` : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [sample.headers.map(esc).join(","), ...sample.rows.slice(0, maxRows).map((r) => r.map(esc).join(","))].join("\n");
}
