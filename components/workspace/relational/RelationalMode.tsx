"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Card, Chip, NumberField, Segmented, Toggle, cx } from "@/components/ui/controls";
import { AlertIcon } from "@/components/ui/icons";
import { useNotify } from "@/components/ui/notices";
import { generateRelational, totalRows, validateRelationalConfig, worstCaseRows } from "@/lib/engines/relational/generate";
import {
  DEFAULT_RELATIONAL_CONFIG,
  MAX_CUSTOMERS,
  MAX_TOTAL_ROWS,
  type RelCell,
  type RelationalConfig,
  type RelationalDataset,
  type Table,
  type TableName,
} from "@/lib/engines/relational/schema";
import { tamperDataset, validateRelational } from "@/lib/engines/relational/validate";
import { currencyExponent, formatMoney, minorToDecimalString } from "@/lib/engines/shared/money";
import type { GlobalSettings } from "@/lib/engines/shared/locales";
import { CSV_BOM, CSV_MIME, toCsv } from "@/lib/export/csv";
import { downloadFile, fileStem } from "@/lib/export/download";
import { JSON_MIME, rowsToRecords, toJson } from "@/lib/export/json";
import { SQL_MIME, toPostgresDump } from "@/lib/export/sql";
import { ZIP_MIME, createZip } from "@/lib/export/zip";
import { DataTable, NullCell } from "../DataTable";
import { ExportMenu } from "../ExportMenu";
import { GlobalSettingsCard } from "../GlobalSettingsCard";
import { ModeLayout } from "../ModeLayout";
import { MODES, type ModeProps } from "../modes";
import { SchemaDiagram } from "./SchemaDiagram";
import { ValidationPanel } from "./ValidationPanel";

const meta = MODES.find((m) => m.id === "relational")!;
const PREVIEW_ROWS = 100;

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

/** Money columns (*_minor) stay exact integer minor units, matching the SQL dump. */
function tableCsv(table: Table): string {
  return toCsv(
    table.def.columns.map((c) => c.name),
    table.rows,
  );
}

function tableRecords(table: Table) {
  return rowsToRecords(
    table.def.columns.map((c) => c.name),
    table.rows,
  );
}

function RangeFields({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: { min: number; max: number };
  min: number;
  max: number;
  onChange: (value: { min: number; max: number }) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-navy">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Min" value={value.min} min={min} max={max} onChange={(v) => onChange({ ...value, min: v })} />
        <NumberField label="Max" value={value.max} min={min} max={max} onChange={(v) => onChange({ ...value, max: v })} />
      </div>
    </fieldset>
  );
}

export function RelationalMode({ active, settings, onSettingsChange }: ModeProps) {
  const [config, setConfig] = useState<RelationalConfig>(DEFAULT_RELATIONAL_CONFIG);
  const [selected, setSelected] = useState<TableName>("customers");
  const notify = useNotify();
  const deferredConfig = useDeferredValue(config);
  const deferredSettings = useDeferredValue(settings);

  const issues = useMemo(() => validateRelationalConfig(config), [config]);

  const generated = useMemo(() => {
    if (!active || validateRelationalConfig(deferredConfig).length > 0) return null;
    const { value: dataset, ms } = timed(() => generateRelational(deferredConfig, deferredSettings));
    const report = validateRelational(dataset, deferredConfig);
    return { dataset, report, ms, config: deferredConfig, settings: deferredSettings };
  }, [active, deferredConfig, deferredSettings]);

  const stale = deferredConfig !== config || deferredSettings !== settings;
  const patch = (partial: Partial<RelationalConfig>) => setConfig((c) => ({ ...c, ...partial }));

  const current = (): { dataset: RelationalDataset; settings: GlobalSettings } => {
    if (generated && !stale) return { dataset: generated.dataset, settings: generated.settings };
    return { dataset: generateRelational(config, settings), settings };
  };

  const stem = (s: GlobalSettings) => fileStem("synthetic-relational", `seed-${s.seed}`);

  const exportOptions = [
    {
      id: "sql",
      label: "Postgres SQL dump",
      description: "CREATE TABLE with PK/FK/UNIQUE + INSERTs, one transaction",
      run: () => {
        const { dataset, settings: s } = current();
        downloadFile(`${stem(s)}.sql`, toPostgresDump(dataset, { seed: s.seed, generatedFor: `${s.locale} / ${s.currency}` }), SQL_MIME);
        notify({ tone: "success", message: `Exported a SQL dump with ${totalRows(dataset).toLocaleString()} rows.` });
      },
    },
    {
      id: "zip",
      label: "All tables — CSV (.zip)",
      description: "One CSV per table in a single archive",
      run: () => {
        const { dataset, settings: s } = current();
        const zip = createZip(
          dataset.tables.map((t) => ({ name: `${t.def.name}.csv`, content: CSV_BOM + tableCsv(t) })),
        );
        downloadFile(`${stem(s)}-csv.zip`, new Blob([zip], { type: ZIP_MIME }), ZIP_MIME);
        notify({ tone: "success", message: `Exported ${dataset.tables.length} CSV files.` });
      },
    },
    {
      id: "json-all",
      label: "All tables — JSON",
      description: "One object keyed by table name",
      run: () => {
        const { dataset, settings: s } = current();
        const payload = Object.fromEntries(dataset.tables.map((t) => [t.def.name, tableRecords(t)]));
        downloadFile(`${stem(s)}.json`, toJson({ currency: dataset.currency, moneyUnit: "minor", tables: payload }), JSON_MIME);
      },
    },
    {
      id: "csv-one",
      label: `${selected} — CSV`,
      description: "Only the table shown in the preview",
      run: () => {
        const { dataset, settings: s } = current();
        const table = dataset.tables.find((t) => t.def.name === selected);
        if (!table) throw new Error(`Table ${selected} is not part of this dataset`);
        downloadFile(`${stem(s)}-${selected}.csv`, CSV_BOM + tableCsv(table), CSV_MIME);
      },
    },
    {
      id: "json-one",
      label: `${selected} — JSON`,
      description: "Only the table shown in the preview",
      run: () => {
        const { dataset, settings: s } = current();
        const table = dataset.tables.find((t) => t.def.name === selected);
        if (!table) throw new Error(`Table ${selected} is not part of this dataset`);
        downloadFile(`${stem(s)}-${selected}.json`, toJson(tableRecords(table)), JSON_MIME);
      },
    },
  ];

  const worst = worstCaseRows(config);

  return (
    <ModeLayout
      mode={meta.id}
      title={meta.title}
      summary={meta.summary}
      preview={
        issues.length > 0 ? (
          <Card title="Fix these settings to see a preview">
            <ul className="space-y-1.5">
              {issues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-sm text-danger">
                  <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </Card>
        ) : generated ? (
          <div className={cx("space-y-4 transition-opacity", stale && "opacity-70")} aria-busy={stale}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Chip tone="navy">
                {generated.dataset.tables.length} tables · {totalRows(generated.dataset).toLocaleString()} rows
              </Chip>
              <span className="ml-auto text-muted" aria-live="polite">
                {stale ? "Updating…" : `Generated and validated in ${Math.max(1, Math.round(generated.ms))} ms`}
              </span>
            </div>
            <ValidationPanel
              report={generated.report}
              onTamperTest={() => {
                const { dataset, injected } = tamperDataset(generated.dataset);
                const report = validateRelational(dataset, generated.config);
                const totalsCheck = report.checks.find((c) => c.id === "order-totals");
                const caught =
                  Number(report.orphans > 0) + Number((totalsCheck?.violations ?? 0) > 0) + Number(report.duplicates > 0);
                return { caught: Math.min(caught, injected.length), injected, report };
              }}
            />
            <SchemaDiagram
              tables={generated.dataset.tables}
              config={generated.config}
              selected={selected}
              onSelect={setSelected}
            />
            <TablePreview
              dataset={generated.dataset}
              settings={generated.settings}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        ) : null
      }
      config={
        <>
          <GlobalSettingsCard
            settings={settings}
            onChange={onSettingsChange}
            countField={
              <NumberField
                label="Customers"
                hint={`Up to ${MAX_CUSTOMERS.toLocaleString()}. Max ${MAX_TOTAL_ROWS.toLocaleString()} rows across all tables.`}
                value={config.customers}
                min={1}
                max={MAX_CUSTOMERS}
                onChange={(customers) => patch({ customers })}
              />
            }
          />
          <Card title="Relationships" description="Cardinalities between customers, orders and items.">
            <div className="space-y-4">
              <Toggle
                label="Customer profiles (1:1)"
                description="Each profile belongs to exactly one customer."
                checked={config.profiles.enabled}
                onChange={(enabled) => patch({ profiles: { ...config.profiles, enabled } })}
              />
              {config.profiles.enabled && (
                <NumberField
                  label="Profile coverage"
                  suffix="%"
                  hint="Share of customers that have a profile."
                  value={config.profiles.coverage}
                  min={0}
                  max={100}
                  onChange={(coverage) => patch({ profiles: { ...config.profiles, coverage } })}
                />
              )}
              <RangeFields
                label="Orders per customer (1:N)"
                value={config.ordersPerCustomer}
                min={0}
                max={20}
                onChange={(ordersPerCustomer) => patch({ ordersPerCustomer })}
              />
              <RangeFields
                label="Items per order (1:N)"
                value={config.itemsPerOrder}
                min={1}
                max={30}
                onChange={(itemsPerOrder) => patch({ itemsPerOrder })}
              />
            </div>
          </Card>
          <Card title="Catalog" description="Products and categories, linked through a join table.">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Products" value={config.products} min={1} max={1000} onChange={(products) => patch({ products })} />
                <NumberField label="Categories" value={config.categories} min={1} max={20} onChange={(categories) => patch({ categories })} />
              </div>
              <Toggle
                label="Product ↔ category (N:N)"
                description="Adds the product_categories join table."
                checked={config.productCategories.enabled}
                onChange={(enabled) => patch({ productCategories: { ...config.productCategories, enabled } })}
              />
              {config.productCategories.enabled && (
                <RangeFields
                  label="Categories per product"
                  value={config.productCategories}
                  min={1}
                  max={10}
                  onChange={(v) => patch({ productCategories: { ...config.productCategories, ...v } })}
                />
              )}
            </div>
          </Card>
          <p className={cx("px-1 text-xs", worst > MAX_TOTAL_ROWS ? "text-danger" : "text-muted")}>
            Worst case {worst.toLocaleString()} of {MAX_TOTAL_ROWS.toLocaleString()} rows allowed.
          </p>
        </>
      }
      exportBar={
        <ExportMenu
          disabled={issues.length > 0}
          disabledReason={issues.length > 0 ? "Fix the settings above to export." : undefined}
          summary={generated ? `${totalRows(generated.dataset).toLocaleString()} rows · ${generated.report.ok ? "validated" : "has problems"}` : undefined}
          options={exportOptions}
        />
      }
    />
  );
}

function TablePreview({
  dataset,
  settings,
  selected,
  onSelect,
}: {
  dataset: RelationalDataset;
  settings: GlobalSettings;
  selected: TableName;
  onSelect: (name: TableName) => void;
}) {
  const table = dataset.tables.find((t) => t.def.name === selected) ?? dataset.tables[0];
  const rows = table.rows.slice(0, PREVIEW_ROWS);
  const currency = settings.currency;

  const render = (value: RelCell, _r: number, c: number) => {
    if (value === null) return <NullCell />;
    const kind = table.def.columns[c].kind;
    if (kind === "money" && typeof value === "number") {
      return (
        <span title={`${value} minor units = ${minorToDecimalString(value, currency)}`}>
          {formatMoney(value, currency, settings.locale)}
        </span>
      );
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  };

  return (
    <section aria-label="Table preview" className="space-y-2">
      <Segmented
        label="Table"
        value={table.def.name}
        onChange={onSelect}
        options={dataset.tables.map((t) => ({ value: t.def.name, label: t.def.name }))}
      />
      <DataTable
        caption={`${table.def.name}: first ${rows.length} of ${table.rows.length} rows`}
        headers={table.def.columns.map((c) => {
          const pk = table.def.primaryKey.includes(c.name);
          const fk = table.def.foreignKeys.find((f) => f.column === c.name);
          return (
            <span key={c.name} className="inline-flex items-center gap-1.5" title={fk ? `References ${fk.table}.${fk.references}` : undefined}>
              {c.name}
              {pk && <span className="rounded bg-navy px-1 text-[9px] font-semibold text-paper">PK</span>}
              {fk && <span className="rounded bg-teal px-1 text-[9px] font-semibold text-white">FK</span>}
            </span>
          );
        })}
        rows={rows}
        renderCell={render}
        alignRight={(c) => ["int", "money"].includes(table.def.columns[c].kind)}
      />
      <p className="text-xs text-muted">
        Showing {rows.length} of {table.rows.length.toLocaleString()} rows. Money is stored exactly as integer minor units
        ({currencyExponent(currency)} decimals in {currency}) and shown formatted.
      </p>
    </section>
  );
}
