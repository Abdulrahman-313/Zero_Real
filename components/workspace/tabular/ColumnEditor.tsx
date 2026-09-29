"use client";

import { useId, useState } from "react";
import { Button, Card, Chip, NumberField, SelectField, TextField, Toggle, cx, inputClass } from "@/components/ui/controls";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { COLUMN_TYPE_LABELS, changeColumnType, makeColumn } from "@/lib/engines/tabular/columns";
import {
  COLUMN_TYPES,
  MAX_COLUMNS,
  PRIVACY_BY_TYPE,
  type Column,
  type ColumnOf,
  type Distribution,
  type PrivacyRule,
} from "@/lib/engines/tabular/schema";
import { TEXT_KINDS, type TextKind } from "@/lib/engines/shared/text";
import type { ConfigIssue } from "@/lib/engines/tabular/validate";

/** Input styles without the full-width default, for inline rows. */
const compactInput = inputClass.replace("w-full ", "");

const typeOptions = COLUMN_TYPES.map((t) => ({ value: t, label: COLUMN_TYPE_LABELS[t] }));

const PRIVACY_LABELS: Record<PrivacyRule, string> = {
  none: "None",
  mask: "Mask",
  hash: "Hash (SHA-256)",
  noise: "Numeric noise (Laplace)",
};

const DISTRIBUTION_OPTIONS: Array<{ value: Distribution; label: string }> = [
  { value: "uniform", label: "Uniform" },
  { value: "normal", label: "Normal (bell curve)" },
  { value: "lognormal", label: "Log-normal (skewed)" },
];

const TEXT_KIND_LABELS: Record<TextKind, string> = {
  product: "Product description",
  memo: "Payment memo",
  sentence: "Note / sentence",
};

let columnCounter = 0;
function newColumnId(): string {
  columnCounter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `col-${Date.now()}-${columnCounter}`;
}

export function ColumnEditor({
  columns,
  onChange,
  issues,
}: {
  columns: Column[];
  onChange: (columns: Column[]) => void;
  issues: ConfigIssue[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (id: string, next: Column) => onChange(columns.map((c) => (c.id === id ? next : c)));
  const remove = (id: string) => onChange(columns.filter((c) => c.id !== id));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = columns.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () => {
    const taken = new Set(columns.map((c) => c.name.toLowerCase()));
    let n = columns.length + 1;
    while (taken.has(`column_${n}`)) n++;
    const column = makeColumn("text", `column_${n}`, newColumnId());
    onChange([...columns, column]);
    setExpanded(column.id);
  };

  return (
    <Card
      title="Columns"
      description="Name, type, privacy rule and options for each column."
      actions={<Chip tone="neutral">{columns.length}</Chip>}
    >
      {columns.length === 0 && (
        <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          No columns yet. Add one, pick a preset, or infer a schema from a sample.
        </p>
      )}
      <ol className="space-y-2">
        {columns.map((column, index) => {
          const columnIssues = issues.filter((i) => i.columnId === column.id);
          const open = expanded === column.id;
          return (
            <li
              key={column.id}
              className={cx("rounded-xl border bg-white", columnIssues.length > 0 ? "border-danger/60" : "border-line")}
            >
              <div className="flex items-center gap-1.5 p-2">
                <input
                  aria-label={`Column ${index + 1} name`}
                  className={cx(compactInput, "w-0 min-w-0 flex-1 py-1 font-mono text-xs")}
                  value={column.name}
                  maxLength={64}
                  onChange={(e) => update(column.id, { ...column, name: e.target.value })}
                />
                <select
                  aria-label={`Column ${index + 1} type`}
                  className={cx(compactInput, "w-[6.5rem] shrink-0 py-1 text-xs")}
                  value={column.type}
                  onChange={(e) => update(column.id, changeColumnType(column, e.target.value as Column["type"]))}
                >
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-expanded={open}
                  aria-controls={`col-opts-${column.id}`}
                  aria-label={`${open ? "Hide" : "Show"} options for ${column.name || `column ${index + 1}`}`}
                  onClick={() => setExpanded(open ? null : column.id)}
                >
                  <ChevronDownIcon width={16} height={16} className={cx("transition-transform", open && "rotate-180")} />
                </Button>
              </div>
              {column.privacy !== "none" && !open && (
                <div className="-mt-1 px-2 pb-2">
                  <Chip>{PRIVACY_LABELS[column.privacy]}</Chip>
                </div>
              )}
              {columnIssues.map((issue) => (
                <p key={issue.message} className="px-2.5 pb-2 text-xs text-danger" role="alert">
                  {issue.message}
                </p>
              ))}
              {open && (
                <div id={`col-opts-${column.id}`} className="space-y-3 border-t border-line p-3">
                  <TypeOptions column={column} onChange={(next) => update(column.id, next)} />
                  <SelectField
                    label="Privacy rule"
                    value={column.privacy}
                    options={PRIVACY_BY_TYPE[column.type].map((p) => ({ value: p, label: PRIVACY_LABELS[p] }))}
                    onChange={(privacy) => update(column.id, { ...column, privacy })}
                  />
                  {column.privacy === "noise" && (
                    <NumberField
                      label="Privacy budget ε"
                      hint="Smaller ε adds more noise. ε = 1 ≈ 1% of the column range."
                      value={column.noiseEpsilon}
                      min={0.05}
                      max={10}
                      step={0.05}
                      integer={false}
                      onChange={(noiseEpsilon) => update(column.id, { ...column, noiseEpsilon })}
                    />
                  )}
                  {column.type !== "id" && (
                    <Toggle
                      label="Nullable"
                      description="Allow the null rate to blank this column."
                      checked={column.nullable}
                      onChange={(nullable) => update(column.id, { ...column, nullable })}
                    />
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Move column up" disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUpIcon width={16} height={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move column down"
                        disabled={index === columns.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon width={16} height={16} />
                      </Button>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => remove(column.id)}>
                      <TrashIcon width={14} height={14} />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Button className="mt-3 w-full" onClick={add} disabled={columns.length >= MAX_COLUMNS}>
        <PlusIcon width={16} height={16} />
        Add column
      </Button>
    </Card>
  );
}

function TypeOptions({ column, onChange }: { column: Column; onChange: (column: Column) => void }) {
  switch (column.type) {
    case "id":
      return <IdOptions column={column} onChange={onChange} />;
    case "name":
      return (
        <SelectField
          label="Name format"
          value={column.format}
          options={[
            { value: "full", label: "Full name" },
            { value: "first", label: "First name" },
            { value: "last", label: "Last name" },
          ]}
          onChange={(format) => onChange({ ...column, format })}
        />
      );
    case "email":
      return <p className="text-xs text-muted">Derived from the row&apos;s name, always on reserved example.com / .org / .net domains.</p>;
    case "date":
      return <DateOptions column={column} onChange={onChange} />;
    case "currency":
    case "number":
      return <NumericOptions column={column} onChange={onChange} />;
    case "category":
      return <CategoryOptions column={column} onChange={onChange} />;
    case "boolean":
      return (
        <NumberField
          label="Chance of true"
          suffix="%"
          value={Math.round(column.trueProbability * 100)}
          min={0}
          max={100}
          onChange={(v) => onChange({ ...column, trueProbability: v / 100 })}
        />
      );
    case "text":
      return (
        <SelectField
          label="Text kind"
          hint="AI text pools, when generated, replace the built-in templates."
          value={column.kind}
          options={TEXT_KINDS.map((k) => ({ value: k, label: TEXT_KIND_LABELS[k] }))}
          onChange={(kind) => onChange({ ...column, kind })}
        />
      );
  }
}

function IdOptions({ column, onChange }: { column: ColumnOf<"id">; onChange: (column: Column) => void }) {
  return (
    <div className="space-y-3">
      <SelectField
        label="ID style"
        value={column.mode}
        options={[
          { value: "sequence", label: "Sequential number" },
          { value: "uuid", label: "UUID" },
        ]}
        onChange={(mode) => onChange({ ...column, mode })}
      />
      {column.mode === "sequence" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Start" value={column.start} min={0} max={1_000_000_000} onChange={(start) => onChange({ ...column, start })} />
          <NumberField label="Step" value={column.step} min={1} max={1000} onChange={(step) => onChange({ ...column, step })} />
        </div>
      )}
    </div>
  );
}

function DateOptions({ column, onChange }: { column: ColumnOf<"date">; onChange: (column: Column) => void }) {
  const id = useId();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-from`} className="text-xs font-medium text-navy">
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            className={inputClass}
            value={column.min}
            onChange={(e) => e.target.value && onChange({ ...column, min: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-to`} className="text-xs font-medium text-navy">
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            className={inputClass}
            value={column.max}
            onChange={(e) => e.target.value && onChange({ ...column, max: e.target.value })}
          />
        </div>
      </div>
      <SelectField
        label="Output format"
        value={column.format}
        options={[
          { value: "iso", label: "ISO (2025-02-11)" },
          { value: "locale", label: "Locale format" },
        ]}
        onChange={(format) => onChange({ ...column, format })}
      />
    </div>
  );
}

function NumericOptions({
  column,
  onChange,
}: {
  column: ColumnOf<"number"> | ColumnOf<"currency">;
  onChange: (column: Column) => void;
}) {
  const isCurrency = column.type === "currency";
  const limit = isCurrency ? 1e9 : 1e12;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Minimum"
          value={column.min}
          min={-limit}
          max={limit}
          integer={false}
          step={isCurrency ? 0.01 : 1}
          onChange={(min) => onChange({ ...column, min })}
        />
        <NumberField
          label="Maximum"
          value={column.max}
          min={-limit}
          max={limit}
          integer={false}
          step={isCurrency ? 0.01 : 1}
          onChange={(max) => onChange({ ...column, max })}
        />
      </div>
      <SelectField
        label="Distribution"
        value={column.distribution}
        options={DISTRIBUTION_OPTIONS}
        onChange={(distribution) => onChange({ ...column, distribution })}
      />
      {column.type === "number" && (
        <NumberField
          label="Decimal places"
          value={column.decimals}
          min={0}
          max={6}
          onChange={(decimals) => onChange({ ...column, decimals })}
        />
      )}
    </div>
  );
}

function formatCategories(values: ColumnOf<"category">["values"]): string {
  return values.map((v) => (v.weight === 1 ? v.value : `${v.value}:${v.weight}`)).join(", ");
}

function parseCategories(text: string): ColumnOf<"category">["values"] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((part) => {
      const match = /^(.*?):\s*(\d+(?:\.\d+)?)$/.exec(part);
      if (match && match[1].trim() !== "") return { value: match[1].trim().slice(0, 80), weight: Math.min(1000, Number(match[2])) };
      return { value: part.slice(0, 80), weight: 1 };
    });
}

function CategoryOptions({ column, onChange }: { column: ColumnOf<"category">; onChange: (column: Column) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      label="Values (comma-separated, optional :weight)"
      hint="Example: Bronze:5, Silver:3, Gold:1"
      value={draft ?? formatCategories(column.values)}
      onChange={(text) => {
        setDraft(text);
        onChange({ ...column, values: parseCategories(text) });
      }}
    />
  );
}
