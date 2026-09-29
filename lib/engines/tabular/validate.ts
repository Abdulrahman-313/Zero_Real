import { isoToDay, isValidIsoDate } from "../shared/dates";
import { PRIVACY_BY_TYPE, tabularConfigSchema, type TabularConfig } from "./schema";

export interface ConfigIssue {
  /** Column id the issue belongs to, if any. */
  columnId?: string;
  message: string;
}

/** Human-readable problems that block generation. Empty array means the config is valid. */
export function validateTabularConfig(config: TabularConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (config.columns.length === 0) {
    issues.push({ message: "Add at least one column to generate data." });
  }

  const seen = new Map<string, string>();
  for (const c of config.columns) {
    const name = c.name.trim();
    if (name === "") {
      issues.push({ columnId: c.id, message: "Column name cannot be empty." });
    } else {
      const key = name.toLowerCase();
      if (seen.has(key)) issues.push({ columnId: c.id, message: `Duplicate column name "${name}".` });
      seen.set(key, c.id);
    }

    if (!PRIVACY_BY_TYPE[c.type].includes(c.privacy)) {
      issues.push({ columnId: c.id, message: `"${c.privacy}" privacy is not available for ${c.type} columns.` });
    }

    switch (c.type) {
      case "number":
      case "currency":
        if (c.min > c.max) issues.push({ columnId: c.id, message: `"${name}": minimum is greater than maximum.` });
        break;
      case "date":
        if (!isValidIsoDate(c.min) || !isValidIsoDate(c.max)) {
          issues.push({ columnId: c.id, message: `"${name}": use valid dates (YYYY-MM-DD).` });
        } else if (isoToDay(c.min) > isoToDay(c.max)) {
          issues.push({ columnId: c.id, message: `"${name}": start date is after end date.` });
        }
        break;
      case "category": {
        const values = c.values.filter((v) => v.value.trim() !== "");
        if (values.length === 0) issues.push({ columnId: c.id, message: `"${name}": add at least one category value.` });
        else if (values.every((v) => v.weight <= 0))
          issues.push({ columnId: c.id, message: `"${name}": at least one category needs a weight above 0.` });
        break;
      }
      default:
        break;
    }
  }

  // Catch anything the targeted checks above did not (ranges, limits).
  if (issues.length === 0) {
    const parsed = tabularConfigSchema.safeParse(config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 3)) {
        issues.push({ message: `Invalid setting at ${issue.path.join(".") || "config"}: ${issue.message}` });
      }
    }
  }

  return issues;
}
