import type { TabularResult } from "./generate";

export interface ColumnProfile {
  name: string;
  nulls: number;
  distinct: number;
  /** Numeric min/max, or lexical min/max for ISO dates; null when not meaningful. */
  min: number | string | null;
  max: number | string | null;
  mean: number | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Summary statistics per column, for the "statistical fidelity" panel. */
export function profileTabular(result: TabularResult): ColumnProfile[] {
  return result.headers.map((name, j) => {
    const distinct = new Set<string>();
    let nulls = 0;
    let numMin = Infinity;
    let numMax = -Infinity;
    let sum = 0;
    let numeric = 0;
    let dateMin: string | null = null;
    let dateMax: string | null = null;
    const type = result.types[j];

    for (const row of result.rows) {
      const v = row[j];
      if (v === null) {
        nulls++;
        continue;
      }
      distinct.add(String(v));
      if (typeof v === "number" && (type === "number" || type === "currency" || type === "id")) {
        if (v < numMin) numMin = v;
        if (v > numMax) numMax = v;
        sum += v;
        numeric++;
      } else if (type === "date" && typeof v === "string" && ISO.test(v)) {
        if (dateMin === null || v < dateMin) dateMin = v;
        if (dateMax === null || v > dateMax) dateMax = v;
      }
    }

    if (numeric > 0) {
      return { name, nulls, distinct: distinct.size, min: numMin, max: numMax, mean: sum / numeric };
    }
    return { name, nulls, distinct: distinct.size, min: dateMin, max: dateMax, mean: null };
  });
}
