import type { GlobalSettings } from "@/lib/engines/shared/locales";

export const MODES = [
  {
    id: "tabular",
    label: "Tabular",
    title: "Tabular data",
    summary: "Rows from a column schema, with privacy controls per column.",
  },
  {
    id: "relational",
    label: "Relational",
    title: "Relational structures",
    summary: "Linked tables with PK/FK integrity and reconciled totals.",
  },
  {
    id: "documents",
    label: "Documents",
    title: "Document generator",
    summary: "Invoices and bank statements that always add up.",
  },
] as const;

export type ModeId = (typeof MODES)[number]["id"];

export function isModeId(value: string): value is ModeId {
  return MODES.some((m) => m.id === value);
}

export const PIPELINE_STEPS = [
  { id: "ingest", label: "Ingest schema", detail: "Types, keys and ranges from a sample or by hand" },
  { id: "model", label: "Model relationships", detail: "Distributions and FK cardinalities" },
  { id: "generate", label: "Generate with AI", detail: "Realistic text and edge cases" },
  { id: "validate", label: "Validate & export", detail: "Integrity checks, then CSV / JSON / SQL / PDF" },
] as const;

export interface ModeProps {
  /** Whether this mode is the visible one (inactive modes skip live regeneration). */
  active: boolean;
  settings: GlobalSettings;
  onSettingsChange: (settings: GlobalSettings) => void;
}
