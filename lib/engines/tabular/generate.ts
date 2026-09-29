import { dayToIso, formatDay, isoToDay } from "../shared/dates";
import type { GlobalSettings } from "../shared/locales";
import { fromMinor, toMinor } from "../shared/money";
import { getFaker, makeEmail, makePerson, type Person } from "../shared/people";
import { createRng, deriveSeed, type Rng } from "../shared/rng";
import { synthesizeText } from "../shared/text";
import { edgeCasesForType, edgeValue } from "./edgeCases";
import { hashValue, laplaceScale, maskValue } from "./privacy";
import type { CellValue, Column, ColumnType, Distribution, EdgeCaseKind, TabularConfig } from "./schema";

export const FLAG_NULL = 1;
export const FLAG_OUTLIER = 2;
export const FLAG_EDGE = 4;

export interface TabularResult {
  headers: string[];
  types: ColumnType[];
  rows: CellValue[][];
  /** Per-cell bit flags (row-major): FLAG_NULL | FLAG_OUTLIER | FLAG_EDGE. */
  flags: Uint8Array;
  counts: { nulls: number; outliers: number; edgeCases: number };
}

/** Intermediate typed value before formatting and privacy. */
type Typed =
  | { k: "str"; v: string }
  | { k: "num"; v: number } // plain number, or minor units for currency
  | { k: "day"; v: number }
  | { k: "bool"; v: boolean }
  | null;

interface Prepared {
  column: Column;
  edgeKinds: EdgeCaseKind[];
  /** Numeric range used for noise scale (minor units for currency, days for dates). */
  range: number;
  lo: number;
  hi: number;
  pool: readonly string[] | undefined;
}

const OUTLIER_FACTORS = [10, 25, 50, 100];

function sampleDistribution(dist: Distribution, min: number, max: number, rng: Rng): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  switch (dist) {
    case "uniform":
      return rng.float(lo, hi);
    case "normal": {
      const mean = (lo + hi) / 2;
      const sd = (hi - lo) / 6;
      return Math.min(hi, Math.max(lo, mean + sd * rng.normal()));
    }
    case "lognormal": {
      // Right-skewed: median at 20% of the range, long tail clipped at max.
      const x = 0.2 * Math.exp(0.8 * rng.normal());
      return lo + (hi - lo) * Math.min(1, x);
    }
  }
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function prepare(column: Column, config: TabularConfig): Prepared {
  const enabled = new Set(config.edgeCases.kinds);
  const edgeKinds = edgeCasesForType(column.type).filter((k) => enabled.has(k));
  let lo = 0;
  let hi = 0;
  if (column.type === "date") {
    lo = isoToDay(column.min);
    hi = isoToDay(column.max);
  } else if (column.type === "currency") {
    lo = Math.min(column.min, column.max);
    hi = Math.max(column.min, column.max);
  } else if (column.type === "number") {
    lo = Math.min(column.min, column.max);
    hi = Math.max(column.min, column.max);
  }
  const range = column.type === "currency" ? (hi - lo) * 100 : hi - lo;
  const pool = column.type === "text" ? config.textPools[column.name]?.filter((t) => t.trim() !== "") : undefined;
  return { column, edgeKinds, range, lo, hi, pool: pool && pool.length > 0 ? pool : undefined };
}

function generateTyped(p: Prepared, index: number, person: () => Person, settings: GlobalSettings, rng: Rng): Typed {
  const c = p.column;
  switch (c.type) {
    case "id":
      if (c.mode === "uuid") {
        const faker = getFaker(settings.locale);
        faker.seed(deriveSeed(settings.seed, "uuid", index, c.name));
        return { k: "str", v: faker.string.uuid() };
      }
      return { k: "num", v: c.start + index * c.step };
    case "name": {
      const who = person();
      const v = c.format === "first" ? who.first : c.format === "last" ? who.last : `${who.first} ${who.last}`;
      return { k: "str", v };
    }
    case "email":
      return { k: "str", v: makeEmail(person(), rng) };
    case "date":
      return { k: "day", v: rng.int(p.lo, p.hi) };
    case "currency":
      return { k: "num", v: toMinor(sampleDistribution(c.distribution, p.lo, p.hi, rng), settings.currency) };
    case "number":
      return { k: "num", v: roundTo(sampleDistribution(c.distribution, p.lo, p.hi, rng), c.decimals) };
    case "category": {
      const values = c.values.filter((v) => v.value !== "");
      if (values.length === 0) return null;
      return { k: "str", v: rng.weighted(values.map((v) => v.value), values.map((v) => v.weight)) };
    }
    case "boolean":
      return { k: "bool", v: rng.chance(c.trueProbability) };
    case "text":
      return { k: "str", v: p.pool ? rng.pick(p.pool) : synthesizeText(c.kind, rng) };
  }
}

function formatTyped(t: Typed, column: Column, settings: GlobalSettings): CellValue {
  if (t === null) return null;
  switch (t.k) {
    case "str":
    case "bool":
      return t.v;
    case "num":
      return column.type === "currency" ? fromMinor(t.v, settings.currency) : t.v;
    case "day":
      return column.type === "date" && column.format === "locale" ? formatDay(t.v, settings.locale) : dayToIso(t.v);
  }
}

/**
 * Generates a tabular dataset. Pure and deterministic: every cell is derived from
 * (seed, row index, column name), so rows are independent and `limit` returns an
 * exact prefix of the full dataset.
 */
export function generateTabular(config: TabularConfig, settings: GlobalSettings, limit?: number): TabularResult {
  const count = Math.max(0, Math.min(config.rowCount, limit ?? config.rowCount));
  const prepared = config.columns.map((c) => prepare(c, config));
  const width = prepared.length;
  const rows: CellValue[][] = new Array(count);
  const flags = new Uint8Array(count * width);
  const counts = { nulls: 0, outliers: 0, edgeCases: 0 };
  const faker = getFaker(settings.locale);
  const salt = deriveSeed(settings.seed, "salt").toString(16);
  const nullP = config.nullRate / 100;
  const outlierP = config.outlierRate / 100;
  const edgeP = config.edgeCases.rate / 100;

  for (let i = 0; i < count; i++) {
    let cachedPerson: Person | undefined;
    const person = () => {
      if (!cachedPerson) {
        const seed = deriveSeed(settings.seed, "person", i);
        faker.seed(seed);
        cachedPerson = makePerson(settings.locale, faker, createRng(seed));
      }
      return cachedPerson;
    };

    const row: CellValue[] = new Array(width);
    for (let j = 0; j < width; j++) {
      const p = prepared[j];
      const c = p.column;
      const cellRng = createRng(deriveSeed(settings.seed, "cell", i, c.name));
      // A separate stream for quality decisions keeps base values stable when rates change,
      // and makes rates monotonic (raising the null rate only adds nulls).
      const q = createRng(deriveSeed(settings.seed, "quality", i, c.name));
      const uNull = q.next();
      const uEdge = q.next();
      const uOutlier = q.next();
      let flag = 0;

      let typed = generateTyped(p, i, person, settings, cellRng);

      if (c.nullable && c.type !== "id" && uNull < nullP) {
        typed = null;
        flag |= FLAG_NULL;
      } else if (p.edgeKinds.length > 0 && uEdge < edgeP) {
        const ev = edgeValue(q.pick(p.edgeKinds), c.type, q);
        if (ev) {
          flag |= FLAG_EDGE;
          if (ev.kind === "string") typed = { k: "str", v: ev.value };
          else if (ev.kind === "date") typed = { k: "day", v: isoToDay(ev.iso) };
          else if (c.type === "currency")
            typed = { k: "num", v: toMinor(Math.min(ev.value, 99_999_999.99), settings.currency) };
          else typed = { k: "num", v: ev.value };
        }
      } else if ((c.type === "number" || c.type === "currency") && typed?.k === "num" && uOutlier < outlierP) {
        const factor = q.pick(OUTLIER_FACTORS);
        const v = q.chance(0.25) ? -Math.abs(typed.v) * factor : typed.v * factor;
        typed = { k: "num", v: c.type === "currency" ? Math.round(v) : roundTo(v, c.decimals) };
        flag |= FLAG_OUTLIER;
      }

      if (c.privacy === "noise" && typed && (typed.k === "num" || typed.k === "day")) {
        const noise = createRng(deriveSeed(settings.seed, "noise", i, c.name)).laplace(laplaceScale(p.range, c.noiseEpsilon));
        if (typed.k === "day") typed = { k: "day", v: typed.v + Math.round(noise) };
        else if (c.type === "currency") typed = { k: "num", v: typed.v + Math.round(noise) };
        else if (c.type === "number") typed = { k: "num", v: roundTo(typed.v + noise, c.decimals) };
      }

      let value = formatTyped(typed, c, settings);
      if (value !== null && c.privacy === "mask") value = maskValue(String(value), c.type);
      else if (value !== null && c.privacy === "hash") value = hashValue(String(value), salt);

      row[j] = value;
      if (flag) {
        flags[i * width + j] = flag;
        if (flag & FLAG_NULL) counts.nulls++;
        if (flag & FLAG_EDGE) counts.edgeCases++;
        if (flag & FLAG_OUTLIER) counts.outliers++;
      }
    }
    rows[i] = row;
  }

  return { headers: config.columns.map((c) => c.name), types: config.columns.map((c) => c.type), rows, flags, counts };
}
