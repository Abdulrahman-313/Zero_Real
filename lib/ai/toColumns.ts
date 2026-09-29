import { isValidIsoDate } from "@/lib/engines/shared/dates";
import { makeColumn } from "@/lib/engines/tabular/columns";
import { MAX_COLUMNS, type Column } from "@/lib/engines/tabular/schema";
import type { InferredColumn } from "./schemas";

function safeName(name: string, taken: Set<string>): string {
  const base = name.trim().slice(0, 64) || "column";
  let candidate = base;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${base.slice(0, 60)}_${n++}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** Converts inferred columns into valid tabular column configs (ranges sanitised, safe defaults). */
export function inferredToColumns(inferred: InferredColumn[], idPrefix: string): Column[] {
  const taken = new Set<string>();
  return inferred.slice(0, MAX_COLUMNS).map((c, i) => {
    const id = `${idPrefix}-${i}`;
    const name = safeName(c.name, taken);
    const nullable = c.type !== "id" && c.nullable;
    switch (c.type) {
      case "id": {
        const col = makeColumn("id", name, id);
        if (col.type !== "id") return col;
        if (c.uuid) return { ...col, mode: "uuid" };
        const start = c.min !== null && Number.isInteger(c.min) && c.min >= 0 && c.min <= 1_000_000_000 ? c.min : col.start;
        return { ...col, start };
      }
      case "number":
      case "currency": {
        const col = makeColumn(c.type, name, id);
        if (col.type !== "number" && col.type !== "currency") return col;
        let min = c.min ?? col.min;
        let max = c.max ?? col.max;
        if (min > max) [min, max] = [max, min];
        if (min === max) max = min + Math.max(1, Math.abs(min) * 0.1);
        const limit = c.type === "currency" ? 1e9 : 1e12;
        min = Math.max(-limit, min);
        max = Math.min(limit, max);
        return col.type === "number"
          ? { ...col, nullable, min, max, decimals: c.decimals ?? 0, distribution: "normal" }
          : { ...col, nullable, min, max, distribution: "lognormal" };
      }
      case "date": {
        const col = makeColumn("date", name, id);
        if (col.type !== "date") return col;
        const min = c.dateMin && isValidIsoDate(c.dateMin) ? c.dateMin : col.min;
        const max = c.dateMax && isValidIsoDate(c.dateMax) ? c.dateMax : col.max;
        return { ...col, nullable, min: min <= max ? min : max, max: min <= max ? max : min };
      }
      case "category": {
        const values = [...new Set(c.categories.map((v) => v.trim()).filter(Boolean))].slice(0, 50);
        if (values.length === 0) return { ...makeColumn("text", name, id), nullable };
        const col = makeColumn("category", name, id);
        return col.type === "category" ? { ...col, nullable, values: values.map((value) => ({ value: value.slice(0, 80), weight: 1 })) } : col;
      }
      case "text": {
        const col = makeColumn("text", name, id);
        return col.type === "text" ? { ...col, nullable, kind: c.textKind ?? "sentence" } : col;
      }
      default:
        return { ...makeColumn(c.type, name, id), nullable };
    }
  });
}

export const EXAMPLE_SAMPLE = `customer_id,full_name,email,signup_date,plan,monthly_spend,is_active,notes
1001,Maria Chen,m.chen@example.com,2025-02-11,Pro,482.10,true,Asked about annual billing
1002,Ahmed Raza,a.raza@example.com,2025-03-04,Basic,129.55,true,
1003,Sofia Ivanova,s.ivanova@example.com,2025-01-27,Pro,918.42,false,Requested invoice copy
1004,Liam O'Connor,liam.oc@example.com,2025-04-19,Team,1204.00,true,Migrated from trial
1005,Priya Nair,p.nair@example.com,2025-05-02,Basic,76.20,true,
1006,Jonas Weber,j.weber@example.com,2025-02-28,Team,1530.75,true,Needs SSO setup
1007,Amara Okafor,a.okafor@example.com,2025-06-13,Pro,644.90,false,Card declined twice`;
