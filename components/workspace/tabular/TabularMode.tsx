"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Card, Chip, NumberField, SelectField, Toggle, cx } from "@/components/ui/controls";
import { AlertIcon } from "@/components/ui/icons";
import { useNotify } from "@/components/ui/notices";
import { currencyExponent, formatMoney, toMinor } from "@/lib/engines/shared/money";
import { COLUMN_TYPE_LABELS } from "@/lib/engines/tabular/columns";
import { EDGE_CASES } from "@/lib/engines/tabular/edgeCases";
import { FLAG_EDGE, FLAG_NULL, FLAG_OUTLIER, generateTabular, type TabularResult } from "@/lib/engines/tabular/generate";
import { DEFAULT_TABULAR_CONFIG, TABULAR_PRESETS } from "@/lib/engines/tabular/presets";
import { profileTabular } from "@/lib/engines/tabular/profile";
import { EDGE_CASE_KINDS, MAX_ROWS, type CellValue, type EdgeCaseKind, type TabularConfig } from "@/lib/engines/tabular/schema";
import { validateTabularConfig } from "@/lib/engines/tabular/validate";
import type { GlobalSettings } from "@/lib/engines/shared/locales";
import { CSV_BOM, CSV_MIME, toCsv } from "@/lib/export/csv";
import { downloadFile, fileStem } from "@/lib/export/download";
import { JSON_MIME, rowsToRecords, toJson } from "@/lib/export/json";
import { DataTable, NullCell } from "../DataTable";
import { ExportMenu } from "../ExportMenu";
import { GlobalSettingsCard } from "../GlobalSettingsCard";
import { ModeLayout } from "../ModeLayout";
import { MODES, type ModeProps } from "../modes";
import { ColumnEditor } from "./ColumnEditor";

const meta = MODES.find((m) => m.id === "tabular")!;

const PREVIEW_ROWS = 100;
/** Rows used for live statistics; exports always generate the full row count. */
const PROFILE_SAMPLE = 2000;

const presetOptions = [
  { value: "", label: "Load a preset…" },
  ...TABULAR_PRESETS.map((p) => ({ value: p.id, label: `${p.label} — ${p.description}` })),
];

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  const p = (part / whole) * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

export function TabularMode({ active, settings, onSettingsChange }: ModeProps) {
  const [config, setConfig] = useState<TabularConfig>(DEFAULT_TABULAR_CONFIG);
  const notify = useNotify();
  const deferredConfig = useDeferredValue(config);
  const deferredSettings = useDeferredValue(settings);

  const issues = useMemo(() => validateTabularConfig(config), [config]);
  const deferredIssues = useMemo(() => validateTabularConfig(deferredConfig), [deferredConfig]);

  const sample = useMemo(() => {
    if (!active || deferredIssues.length > 0) return null;
    const { value, ms } = timed(() =>
      generateTabular(deferredConfig, deferredSettings, Math.min(deferredConfig.rowCount, PROFILE_SAMPLE)),
    );
    return { result: value, ms, profile: profileTabular(value) };
  }, [active, deferredConfig, deferredSettings, deferredIssues.length]);

  const stale = deferredConfig !== config || deferredSettings !== settings;

  const patch = (partial: Partial<TabularConfig>) => setConfig((c) => ({ ...c, ...partial }));

  const exportFull = (kind: "csv" | "json") => {
    const result = generateTabular(config, settings);
    const stem = fileStem("synthetic-tabular", `seed-${settings.seed}`, `${result.rows.length}-rows`);
    if (kind === "csv") {
      // Currency keeps its fixed minor-unit precision in CSV (199.90, not 199.9).
      const digits = currencyExponent(settings.currency);
      const rows = result.rows.map((row) =>
        row.map((v, j) => (result.types[j] === "currency" && typeof v === "number" ? v.toFixed(digits) : v)),
      );
      downloadFile(`${stem}.csv`, CSV_BOM + toCsv(result.headers, rows), CSV_MIME);
    } else {
      downloadFile(`${stem}.json`, toJson(rowsToRecords(result.headers, result.rows)), JSON_MIME);
    }
    notify({ tone: "success", message: `Exported ${result.rows.length.toLocaleString()} rows as ${kind.toUpperCase()}.` });
  };

  const exportConfig = () => {
    downloadFile(
      `${fileStem("synthetic-tabular-config", `seed-${settings.seed}`)}.json`,
      toJson({ settings, config }),
      JSON_MIME,
    );
  };

  return (
    <ModeLayout
      mode={meta.id}
      title={meta.title}
      summary={meta.summary}
      headerExtra={
        <SelectField
          label="Preset"
          className="w-full sm:w-72"
          value=""
          options={presetOptions}
          onChange={(id) => {
            const preset = TABULAR_PRESETS.find((p) => p.id === id);
            if (!preset) return;
            patch({ columns: preset.columns, textPools: {} });
            notify({ tone: "info", message: `Loaded the ${preset.label} preset.` });
          }}
        />
      }
      preview={
        <TabularPreview
          config={config}
          settings={deferredSettings}
          issues={issues}
          sample={sample}
          stale={stale}
        />
      }
      config={
        <>
          <GlobalSettingsCard
            settings={settings}
            onChange={onSettingsChange}
            countField={
              <NumberField
                label="Row count"
                hint={`Up to ${MAX_ROWS.toLocaleString()} rows.`}
                value={config.rowCount}
                min={1}
                max={MAX_ROWS}
                onChange={(rowCount) => patch({ rowCount })}
              />
            }
          />
          <Card title="Data quality" description="Inject realistic imperfections.">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Null rate"
                suffix="%"
                value={config.nullRate}
                min={0}
                max={50}
                integer={false}
                step={0.5}
                onChange={(nullRate) => patch({ nullRate })}
              />
              <NumberField
                label="Outlier rate"
                suffix="%"
                value={config.outlierRate}
                min={0}
                max={20}
                integer={false}
                step={0.5}
                onChange={(outlierRate) => patch({ outlierRate })}
              />
            </div>
          </Card>
          <ColumnEditor columns={config.columns} onChange={(columns) => patch({ columns })} issues={issues} />
          <EdgeCaseCard config={config} onChange={(edgeCases) => patch({ edgeCases })} />
        </>
      }
      exportBar={
        <ExportMenu
          disabled={issues.length > 0}
          disabledReason={issues.length > 0 ? "Fix the highlighted settings to export." : undefined}
          summary={`${config.rowCount.toLocaleString()} rows × ${config.columns.length} columns`}
          options={[
            { id: "csv", label: "CSV", description: "RFC 4180, UTF-8 (opens in Excel)", run: () => exportFull("csv") },
            { id: "json", label: "JSON", description: "Array of row objects", run: () => exportFull("json") },
            {
              id: "config",
              label: "Schema & settings",
              description: "Reproduce this dataset later with the same seed",
              run: exportConfig,
            },
          ]}
        />
      }
    />
  );
}

function EdgeCaseCard({
  config,
  onChange,
}: {
  config: TabularConfig;
  onChange: (edgeCases: TabularConfig["edgeCases"]) => void;
}) {
  const presentTypes = new Set(config.columns.map((c) => c.type));
  const enabled = new Set(config.edgeCases.kinds);
  const toggle = (kind: EdgeCaseKind, on: boolean) =>
    onChange({
      ...config.edgeCases,
      kinds: on ? [...config.edgeCases.kinds, kind] : config.edgeCases.kinds.filter((k) => k !== kind),
    });

  return (
    <Card title="Edge cases" description="Mix in values that break naive code. Only applies to matching column types.">
      <div className="space-y-2.5">
        {EDGE_CASE_KINDS.map((kind) => {
          const info = EDGE_CASES[kind];
          const applicable = info.types.some((t) => presentTypes.has(t));
          return (
            <Toggle
              key={kind}
              label={
                <>
                  {info.label}
                  {!applicable && <span className="ml-1 font-normal text-muted">(no matching column)</span>}
                </>
              }
              description={info.description}
              checked={enabled.has(kind)}
              onChange={(on) => toggle(kind, on)}
            />
          );
        })}
        <NumberField
          label="Injection rate"
          suffix="%"
          hint="Share of eligible cells replaced when an edge case is on."
          value={config.edgeCases.rate}
          min={0}
          max={25}
          integer={false}
          step={0.5}
          onChange={(rate) => onChange({ ...config.edgeCases, rate })}
        />
      </div>
    </Card>
  );
}

function TabularPreview({
  config,
  settings,
  issues,
  sample,
  stale,
}: {
  config: TabularConfig;
  settings: GlobalSettings;
  issues: ReturnType<typeof validateTabularConfig>;
  sample: { result: TabularResult; ms: number; profile: ReturnType<typeof profileTabular> } | null;
  stale: boolean;
}) {
  if (issues.length > 0) {
    return (
      <Card title="Fix these settings to see a preview">
        <ul className="space-y-1.5">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-danger">
              <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
              {issue.message}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  if (!sample) return null;

  const { result, ms, profile } = sample;
  const width = result.headers.length;
  const cells = result.rows.length * width;
  const preview = result.rows.slice(0, PREVIEW_ROWS);
  const columns = config.columns.length === width ? config.columns : null;

  const render = (value: CellValue, r: number, c: number) => {
    if (value === null) return <NullCell />;
    const type = result.types[c];
    const privacy = columns?.[c]?.privacy ?? "none";
    if (type === "currency" && typeof value === "number" && privacy !== "hash") {
      return formatMoney(toMinor(value, settings.currency), settings.currency, settings.locale);
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" && value !== value.trim()) return <span className="whitespace-pre">“{value}”</span>;
    if (value === "") return <span className="text-muted italic">(empty)</span>;
    return <span title={String(value).length > 40 ? String(value) : undefined}>{String(value)}</span>;
  };

  const cellClass = (_: CellValue, r: number, c: number) => {
    const f = result.flags[r * width + c];
    if (f & FLAG_OUTLIER) return "bg-warn-soft text-warn font-medium";
    if (f & FLAG_EDGE) return "bg-mint/70 text-teal-dark";
    if (f & FLAG_NULL) return "bg-cream/60";
    return undefined;
  };

  return (
    <div className={cx("space-y-4 transition-opacity", stale && "opacity-70")} aria-busy={stale}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Chip tone="navy">
          {config.rowCount.toLocaleString()} rows × {width} columns
        </Chip>
        <Chip tone="neutral">
          Nulls {percent(result.counts.nulls, cells)}
        </Chip>
        <Chip tone="warn">Outliers {percent(result.counts.outliers, cells)}</Chip>
        <Chip>Edge cases {percent(result.counts.edgeCases, cells)}</Chip>
        <span className="ml-auto text-muted" aria-live="polite">
          {stale ? "Updating…" : `Generated ${result.rows.length.toLocaleString()} sample rows in ${Math.max(1, Math.round(ms))} ms`}
        </span>
      </div>

      <DataTable
        caption={`Preview of the first ${preview.length} generated rows`}
        headers={result.headers.map((h, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {h}
            <span className="font-normal text-muted">{COLUMN_TYPE_LABELS[result.types[i]].toLowerCase()}</span>
            {columns?.[i] && columns[i].privacy !== "none" && <Chip className="!py-0">{columns[i].privacy}</Chip>}
          </span>
        ))}
        rows={preview}
        renderCell={render}
        cellClassName={cellClass}
        alignRight={(c) => ["number", "currency"].includes(result.types[c])}
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>Showing the first {preview.length} of {config.rowCount.toLocaleString()} rows.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-warn-soft ring-1 ring-warn/30" aria-hidden="true" /> Outlier
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-mint ring-1 ring-teal/30" aria-hidden="true" /> Edge case
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted italic">null</span> Null value
        </span>
      </div>

      <Card
        title="Column profile"
        description={`Computed over ${result.rows.length.toLocaleString()} rows${
          config.rowCount > result.rows.length ? " (sample)" : ""
        }.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">Column</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Type</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Nulls</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Distinct</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Min</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Max</th>
                <th scope="col" className="py-1.5 text-right font-medium">Mean</th>
              </tr>
            </thead>
            <tbody>
              {profile.map((p, i) => (
                <tr key={i} className="border-t border-line/70">
                  <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-navy">{p.name}</th>
                  <td className="py-1.5 pr-3 text-muted">{COLUMN_TYPE_LABELS[result.types[i]]}</td>
                  <td className="py-1.5 pr-3 text-right">{p.nulls.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{p.distinct.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{formatStat(p.min)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatStat(p.max)}</td>
                  <td className="py-1.5 text-right">{p.mean === null ? "—" : formatStat(p.mean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatStat(value: number | string | null): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  return Math.abs(value) >= 1e6 ? value.toExponential(2) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
