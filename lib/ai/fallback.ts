import { createRng, hashString } from "@/lib/engines/shared/rng";
import { synthesizeTextPool, type TextKind } from "@/lib/engines/shared/text";
import { edgeCasesForType } from "@/lib/engines/tabular/edgeCases";
import type { EdgeCaseKind } from "@/lib/engines/tabular/schema";
import { parseSample } from "./sample";
import type {
  AiProvider,
  EdgeCasesRequest,
  EdgeCasesResult,
  InferSchemaRequest,
  InferSchemaResult,
  InferredColumn,
  SynthesizeTextRequest,
  SynthesizeTextResult,
} from "./schemas";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOL = /^(true|false|yes|no|y|n)$/i;
const CURRENCY_SYMBOL = /^[-+]?\s*[$£€₹]|^\s*(rs\.?|pkr|usd|gbp|eur)\s*/i;
const MONEY_NAME = /(price|amount|balance|total|cost|salary|fee|revenue|spend|payment|value|income)/i;

function toIsoDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(v);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    // Ambiguous d/m vs m/d: prefer the reading that is valid.
    return a > 12 ? iso(+m[3], b, a) : iso(+m[3], a, b);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(CURRENCY_SYMBOL, "").replace(/[,\s]/g, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function decimalsOf(value: string): number {
  const m = /\.(\d+)/.exec(value.replace(/,/g, ""));
  return m ? Math.min(6, m[1].length) : 0;
}

function textKindFor(name: string): TextKind {
  if (/(desc|product|item|title|summary)/i.test(name)) return "product";
  if (/(memo|note|reference|narration|comment|reason)/i.test(name)) return "memo";
  return "sentence";
}

/** Rule-based type/key inference for one column of sample values. */
export function inferColumn(name: string, raw: Array<string | null>): InferredColumn {
  const values = raw.filter((v): v is string => v !== null && v.trim() !== "");
  const nullable = values.length < raw.length;
  const base: InferredColumn = {
    name,
    type: "text",
    isKey: false,
    nullable,
    min: null,
    max: null,
    decimals: null,
    dateMin: null,
    dateMax: null,
    categories: [],
    textKind: null,
    uuid: false,
  };
  const lname = name.toLowerCase();
  const unique = new Set(values).size === values.length && values.length > 0;
  const keyName = /^id$|_id$|^id_|uuid|guid|_key$/i.test(name) || /[a-z]Id$/.test(name);

  if (values.length === 0) return { ...base, nullable: true, textKind: textKindFor(name) };

  if (values.every((v) => UUID.test(v.trim()))) return { ...base, type: "id", isKey: unique, uuid: true };
  if (values.every((v) => EMAIL.test(v.trim()))) return { ...base, type: "email" };

  const dates = values.map(toIsoDate);
  if (dates.every((d) => d !== null)) {
    const sorted = (dates as string[]).slice().sort();
    return { ...base, type: "date", dateMin: sorted[0], dateMax: sorted[sorted.length - 1] };
  }

  if (values.every((v) => BOOL.test(v.trim()))) return { ...base, type: "boolean" };

  const numbers = values.map(toNumber);
  if (numbers.every((n) => n !== null)) {
    const nums = numbers as number[];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const decimals = Math.max(...values.map(decimalsOf));
    const integers = decimals === 0;
    const hasSymbol = values.some((v) => CURRENCY_SYMBOL.test(v));
    if (integers && unique && (keyName || nums.every((n, i) => i === 0 || n > nums[i - 1]))) {
      return { ...base, type: "id", isKey: true, min, max, decimals: 0 };
    }
    if (hasSymbol || (MONEY_NAME.test(lname) && decimals <= 2)) return { ...base, type: "currency", min, max, decimals: 2 };
    if (integers && values.every((v) => v === "0" || v === "1") && /^(is|has|active|enabled|flag)/i.test(lname)) {
      return { ...base, type: "boolean" };
    }
    return { ...base, type: "number", min, max, decimals };
  }

  if (/(name|customer|holder|person|contact|owner|employee)/i.test(lname) && values.every((v) => /^[\p{Lu}][\p{L}'’.-]*(\s+[\p{Lu}][\p{L}'’.-]*){0,3}$/u.test(v.trim()))) {
    return { ...base, type: "name" };
  }

  const distinct = [...new Set(values.map((v) => v.trim()))];
  const avgLen = values.reduce((s, v) => s + v.length, 0) / values.length;
  if (keyName && unique) return { ...base, type: "id", isKey: true };
  if (distinct.length <= Math.max(3, Math.min(20, Math.ceil(values.length * 0.5))) && avgLen <= 30) {
    return { ...base, type: "category", categories: distinct.slice(0, 20) };
  }
  return { ...base, textKind: textKindFor(name) };
}

export function inferSchemaHeuristic(req: InferSchemaRequest): InferSchemaResult {
  const sample = parseSample(req.sample);
  const columns = sample.headers.map((h, i) => inferColumn(h, sample.rows.map((r) => r[i] ?? null)));
  return { columns, rowsAnalyzed: sample.rows.length };
}

const EDGE_REASONS: Record<EdgeCaseKind, (column: string) => string> = {
  empty_string: (c) => `"${c}" should handle blank strings that are not null.`,
  long_string: (c) => `"${c}" may overflow fixed-width fields or UI layouts.`,
  unicode: (c) => `"${c}" may contain accents or non-Latin scripts.`,
  emoji: (c) => `"${c}" is free text and can include multi-byte emoji.`,
  quotes: (c) => `"${c}" values like O'Brien break naive SQL/CSV escaping.`,
  whitespace: (c) => `"${c}" may arrive with leading or trailing spaces.`,
  boundary_numbers: (c) => `"${c}" should be tested at 0, negative and very large values.`,
  boundary_dates: (c) => `"${c}" should survive leap days, the epoch and far-future dates.`,
  plus_email: (c) => `"${c}" should accept plus-addressed emails.`,
};

export function proposeEdgeCasesHeuristic(req: EdgeCasesRequest): EdgeCasesResult {
  const suggestions = req.columns.flatMap((col) =>
    edgeCasesForType(col.type).map((kind) => ({ column: col.name, kind, reason: EDGE_REASONS[kind](col.name) })),
  );
  return { suggestions: suggestions.slice(0, 60) };
}

export function synthesizeTextHeuristic(req: SynthesizeTextRequest): SynthesizeTextResult {
  const rng = createRng(hashString(`${req.kind}:${req.context.toLowerCase()}`));
  return { texts: synthesizeTextPool(req.kind, req.count, rng) };
}

/** Rule-based provider: no network, deterministic, always available (server and browser). */
export const fallbackProvider: AiProvider = {
  name: "fallback",
  inferSchema: async (req) => inferSchemaHeuristic(req),
  synthesizeText: async (req) => synthesizeTextHeuristic(req),
  proposeEdgeCases: async (req) => proposeEdgeCasesHeuristic(req),
};
