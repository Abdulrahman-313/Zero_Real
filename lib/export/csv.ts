export type CsvCell = string | number | boolean | null | undefined;

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
/** Leading characters spreadsheet apps treat as formulas (CSV injection). */
const FORMULA_START = /^[=+@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 CSV. Optional `comments` are emitted as leading `# ` lines
 * (used for the synthetic-data notice on documents).
 */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
  options: { comments?: readonly string[] } = {},
): string {
  const lines: string[] = [];
  for (const comment of options.comments ?? []) lines.push(`# ${comment}`);
  lines.push(headers.map(csvCell).join(","));
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** UTF-8 BOM so Excel opens accented characters correctly. */
export const CSV_BOM = "﻿";
export const CSV_MIME = "text/csv;charset=utf-8";
