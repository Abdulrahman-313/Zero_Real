import type { Column, ColumnType } from "./schema";
import { PRIVACY_BY_TYPE } from "./schema";

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  id: "ID",
  name: "Name",
  email: "Email",
  date: "Date",
  currency: "Currency",
  category: "Category",
  number: "Number",
  boolean: "Boolean",
  text: "Text",
};

/** Default settings for a new column of the given type. */
export function makeColumn(type: ColumnType, name: string, id: string): Column {
  const base = { id, name, nullable: type !== "id", privacy: "none" as const, noiseEpsilon: 1 };
  switch (type) {
    case "id":
      return { ...base, type, mode: "sequence", start: 10001, step: 1 };
    case "name":
      return { ...base, type, format: "full" };
    case "email":
      return { ...base, type };
    case "date":
      return { ...base, type, min: "2024-01-01", max: "2025-12-31", format: "iso" };
    case "currency":
      return { ...base, type, min: 5, max: 1000, distribution: "lognormal" };
    case "category":
      return {
        ...base,
        type,
        values: [
          { value: "Bronze", weight: 5 },
          { value: "Silver", weight: 3 },
          { value: "Gold", weight: 1 },
        ],
      };
    case "number":
      return { ...base, type, min: 0, max: 100, decimals: 0, distribution: "normal" };
    case "boolean":
      return { ...base, type, trueProbability: 0.5 };
    case "text":
      return { ...base, type, kind: "sentence" };
  }
}

/**
 * Changes a column's type while keeping its identity, name and nullability.
 * Privacy is reset if the old rule does not apply to the new type.
 */
export function changeColumnType(column: Column, type: ColumnType): Column {
  if (column.type === type) return column;
  const next = makeColumn(type, column.name, column.id);
  const privacy = PRIVACY_BY_TYPE[type].includes(column.privacy) ? column.privacy : "none";
  return { ...next, nullable: type === "id" ? false : column.nullable, privacy, noiseEpsilon: column.noiseEpsilon };
}

export function isNumericType(type: ColumnType): type is "number" | "currency" {
  return type === "number" || type === "currency";
}
