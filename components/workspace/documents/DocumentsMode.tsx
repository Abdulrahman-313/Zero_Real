"use client";

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Button, Card, Chip, NumberField, Segmented, SelectField, Toggle, cx, inputClass } from "@/components/ui/controls";
import { AlertIcon, PrinterIcon } from "@/components/ui/icons";
import { useNotify } from "@/components/ui/notices";
import { generateInvoices } from "@/lib/engines/documents/invoice";
import { QUERY_EXAMPLES, parseStatementQuery } from "@/lib/engines/documents/query";
import {
  DEFAULT_INVOICE_CONFIG,
  DEFAULT_STATEMENT_CONFIG,
  MAX_INVOICES,
  MAX_STATEMENT_DAYS,
  MAX_TRANSACTIONS,
  invoiceConfigSchema,
  type InvoiceConfig,
  type StatementConfig,
} from "@/lib/engines/documents/schema";
import { generateStatement, validateStatementConfig } from "@/lib/engines/documents/statement";
import { REGIONS, REGION_TEMPLATES, US_STATES, US_STATE_RATES, formatRate, type Region } from "@/lib/engines/documents/tax";
import { formatDayPattern, isoToDay, isValidIsoDate } from "@/lib/engines/shared/dates";
import type { LocaleId } from "@/lib/engines/shared/locales";
import { formatMoney } from "@/lib/engines/shared/money";
import { CSV_MIME } from "@/lib/export/csv";
import { invoicesCsvZip, statementCsv, statementJson } from "@/lib/export/documents";
import { downloadFile, fileStem } from "@/lib/export/download";
import { JSON_MIME, toJson } from "@/lib/export/json";
import { ZIP_MIME } from "@/lib/export/zip";
import { ExportMenu } from "../ExportMenu";
import { GlobalSettingsCard } from "../GlobalSettingsCard";
import { ModeLayout } from "../ModeLayout";
import { MODES, type ModeProps } from "../modes";
import { InvoiceView } from "./InvoiceView";
import { StatementView } from "./StatementView";

const meta = MODES.find((m) => m.id === "documents")!;
type Kind = "invoice" | "statement";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
const noopSubscribe = () => () => {};

/** Today's date on the client; null during prerender so hydration never mismatches. */
function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, todayIso, () => null);
}

const TERMS = [7, 15, 30, 45, 60] as const;

export function DocumentsMode({ active, settings, onSettingsChange }: ModeProps) {
  const [kind, setKind] = useState<Kind>("invoice");
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfig>(DEFAULT_INVOICE_CONFIG);
  const [statementConfig, setStatementConfig] = useState<StatementConfig>(DEFAULT_STATEMENT_CONFIG);
  const [asOfOverride, setAsOfOverride] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState(false);
  const notify = useNotify();
  const today = useToday();
  const asOf = asOfOverride ?? today;

  const deferredInvoice = useDeferredValue(invoiceConfig);
  const deferredStatement = useDeferredValue(statementConfig);
  const deferredSettings = useDeferredValue(settings);

  const invoiceIssues = useMemo(() => {
    const parsed = invoiceConfigSchema.safeParse(invoiceConfig);
    if (!parsed.success) return parsed.error.issues.slice(0, 2).map((i) => `Invalid ${i.path.join(".")}: ${i.message}`);
    return invoiceConfig.lines.min > invoiceConfig.lines.max ? ["Line items: minimum is greater than maximum."] : [];
  }, [invoiceConfig]);
  const statementIssues = useMemo(() => validateStatementConfig(statementConfig), [statementConfig]);
  const issues = kind === "invoice" ? invoiceIssues : statementIssues;

  const generated = useMemo(() => {
    if (!active || !asOf) return null;
    try {
      if (kind === "invoice") {
        if (invoiceIssues.length > 0) return null;
        return { kind, invoices: generateInvoices(deferredInvoice, deferredSettings, asOf), settings: deferredSettings } as const;
      }
      if (validateStatementConfig(deferredStatement).length > 0) return null;
      return { kind, statement: generateStatement(deferredStatement, deferredSettings, asOf), settings: deferredSettings } as const;
    } catch (error) {
      return { kind: "error", message: error instanceof Error ? error.message : "Could not generate this document." } as const;
    }
  }, [active, asOf, kind, deferredInvoice, deferredStatement, deferredSettings, invoiceIssues.length]);

  const stale = deferredInvoice !== invoiceConfig || deferredStatement !== statementConfig || deferredSettings !== settings;
  const invoices = generated?.kind === "invoice" ? generated.invoices : [];
  const currentPage = Math.min(page, Math.max(0, invoices.length - 1));

  // Ctrl/Cmd+P should also print every generated document, not only the one on screen.
  useEffect(() => {
    if (!active) return;
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [active]);

  const print = () => {
    notify({ tone: "info", message: "Choose “Save as PDF” as the printer to create a PDF." });
    flushSync(() => setPrinting(true));
    window.print();
  };

  const setRegion = (region: Region) => {
    setInvoiceConfig((c) => ({ ...c, region }));
    const template = REGION_TEMPLATES[region];
    onSettingsChange({ ...settings, locale: template.locale, currency: template.currency });
  };

  const stem = fileStem("synthetic", kind, `seed-${settings.seed}`);
  const exportOptions =
    generated?.kind === "invoice"
      ? [
          {
            id: "json",
            label: "JSON",
            description: `${generated.invoices.length} invoice${generated.invoices.length === 1 ? "" : "s"} with line items and tax lines`,
            run: () => downloadFile(`${stem}.json`, toJson(generated.invoices), JSON_MIME),
          },
          {
            id: "csv",
            label: "CSV (.zip)",
            description: "invoices.csv + invoice_lines.csv",
            run: () => downloadFile(`${stem}-csv.zip`, new Blob([invoicesCsvZip(generated.invoices)], { type: ZIP_MIME }), ZIP_MIME),
          },
          {
            id: "print",
            label: "Print / Save as PDF",
            description: "Clean printable layout, one invoice per page",
            icon: <PrinterIcon width={18} height={18} />,
            run: print,
          },
        ]
      : generated?.kind === "statement"
        ? [
            {
              id: "json",
              label: "JSON",
              description: `${generated.statement.transactions.length} transactions with running balance`,
              run: () => downloadFile(`${stem}.json`, toJson(statementJson(generated.statement)), JSON_MIME),
            },
            {
              id: "csv",
              label: "CSV",
              description: "Transactions with debit, credit and balance",
              run: () => downloadFile(`${stem}.csv`, statementCsv(generated.statement), CSV_MIME),
            },
            {
              id: "print",
              label: "Print / Save as PDF",
              description: "Formatted statement document",
              icon: <PrinterIcon width={18} height={18} />,
              run: print,
            },
          ]
        : [];

  return (
    <ModeLayout
      mode={meta.id}
      title={meta.title}
      summary={meta.summary}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Kind>
            label="Document type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "invoice", label: "Invoices" },
              { value: "statement", label: "Bank statement" },
            ]}
          />
          <Button onClick={print} disabled={!generated || generated.kind === "error"}>
            <PrinterIcon width={16} height={16} />
            Print / PDF
          </Button>
        </div>
      }
      preview={
        <div className={cx("transition-opacity", stale && "opacity-70")} aria-busy={stale}>
          {issues.length > 0 ? (
            <IssueList issues={issues} />
          ) : generated?.kind === "error" ? (
            <IssueList issues={[generated.message]} />
          ) : generated?.kind === "invoice" ? (
            <div className="space-y-4">
              {invoices.length > 1 && (
                <div className="no-print">
                  <InvoiceBrowser
                  invoices={invoices}
                  page={currentPage}
                  onPage={setPage}
                  locale={generated.settings.locale}
                  />
                </div>
              )}
              <div className={cx(printing && "no-print")}>
                <InvoiceView invoice={invoices[currentPage]} locale={generated.settings.locale} />
              </div>
              {printing && (
                <div className="print-only">
                  {invoices.map((inv) => (
                    <InvoiceView key={inv.number} invoice={inv} locale={generated.settings.locale} />
                  ))}
                </div>
              )}
            </div>
          ) : generated?.kind === "statement" ? (
            <StatementView statement={generated.statement} locale={generated.settings.locale} />
          ) : null}
        </div>
      }
      config={
        <>
          <GlobalSettingsCard
            settings={settings}
            onChange={onSettingsChange}
            countField={
              kind === "invoice" ? (
                <NumberField
                  label="Invoices to generate"
                  hint={`Bulk generation up to ${MAX_INVOICES}.`}
                  value={invoiceConfig.count}
                  min={1}
                  max={MAX_INVOICES}
                  onChange={(count) => setInvoiceConfig((c) => ({ ...c, count }))}
                />
              ) : undefined
            }
          />
          {kind === "invoice" ? (
            <InvoiceSettings config={invoiceConfig} onChange={setInvoiceConfig} onRegion={setRegion} />
          ) : (
            <StatementSettings config={statementConfig} onChange={setStatementConfig} currencySymbolHint={settings.currency} />
          )}
          <Card title="Reference date" description="Documents are dated relative to this day. Pin it to reproduce output exactly.">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="docs-asof" className="text-xs font-medium text-navy">
                  As of
                </label>
                <input
                  id="docs-asof"
                  type="date"
                  className={inputClass}
                  value={asOf ?? ""}
                  onChange={(e) => setAsOfOverride(e.target.value && isValidIsoDate(e.target.value) ? e.target.value : null)}
                />
              </div>
              {asOfOverride && (
                <Button size="sm" variant="ghost" onClick={() => setAsOfOverride(null)}>
                  Use today
                </Button>
              )}
            </div>
          </Card>
          <p className="px-1 text-xs text-muted">
            Every document is labelled <strong>SYNTHETIC TEST DATA — NOT A REAL DOCUMENT</strong> and uses invented company and bank
            names with obviously fake account and tax numbers.
          </p>
        </>
      }
      exportBar={
        <ExportMenu
          options={exportOptions}
          disabled={exportOptions.length === 0}
          disabledReason={issues.length > 0 || generated?.kind === "error" ? "Fix the settings above to export." : undefined}
          summary={
            generated?.kind === "invoice"
              ? `${generated.invoices.length} invoice${generated.invoices.length === 1 ? "" : "s"}`
              : generated?.kind === "statement"
                ? `${generated.statement.transactions.length} transactions`
                : undefined
          }
        />
      }
    />
  );

}

function IssueList({ issues }: { issues: string[] }) {
  return (
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
  );
}

function InvoiceBrowser({
  invoices,
  page,
  onPage,
  locale,
}: {
  invoices: ReturnType<typeof generateInvoices>;
  page: number;
  onPage: (page: number) => void;
  locale: LocaleId;
}) {
  const grand = invoices.reduce((s, i) => s + i.totalMinor, 0);
  const currency = invoices[0].currency;
  const template = REGION_TEMPLATES[invoices[0].region];
  return (
    <Card
      title={`${invoices.length} invoices generated`}
      description={`Grand total ${formatMoney(grand, currency, locale)} · select one to preview`}
      actions={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous invoice">
            ‹ Prev
          </Button>
          <span className="text-xs text-muted tabular-nums" aria-live="polite">
            {page + 1} / {invoices.length}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= invoices.length - 1} onClick={() => onPage(page + 1)} aria-label="Next invoice">
            Next ›
          </Button>
        </div>
      }
    >
      <div className="max-h-56 overflow-auto rounded-xl border border-line bg-white" role="region" aria-label="Invoice list" tabIndex={0}>
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-paper">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-semibold text-navy">Number</th>
              <th scope="col" className="px-3 py-1.5 font-semibold text-navy">Buyer</th>
              <th scope="col" className="px-3 py-1.5 font-semibold text-navy">Issued</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold text-navy">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.number} className={cx("border-t border-line/70", i === page && "bg-mint/60")}>
                <td className="px-3 py-1">
                  <button type="button" className="font-mono text-teal hover:underline" onClick={() => onPage(i)} aria-current={i === page ? "true" : undefined}>
                    {inv.number}
                  </button>
                </td>
                <td className="px-3 py-1">{inv.buyer.name}</td>
                <td className="px-3 py-1">{formatDayPattern(isoToDay(inv.issueDate), template.datePattern)}</td>
                <td className="px-3 py-1 text-right">{formatMoney(inv.totalMinor, inv.currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InvoiceSettings({
  config,
  onChange,
  onRegion,
}: {
  config: InvoiceConfig;
  onChange: (update: (c: InvoiceConfig) => InvoiceConfig) => void;
  onRegion: (region: Region) => void;
}) {
  return (
    <Card title="Invoice template" description="Region sets tax rules, date format and currency.">
      <div className="space-y-3">
        <SelectField
          label="Region"
          value={config.region}
          options={REGIONS.map((r) => ({ value: r, label: REGION_TEMPLATES[r].label }))}
          hint={`Dates as ${REGION_TEMPLATES[config.region].datePattern}.`}
          onChange={onRegion}
        />
        {config.region === "US" && (
          <SelectField
            label="State (sales tax)"
            value={config.usState}
            options={US_STATES.map((s) => ({ value: s, label: `${US_STATE_RATES[s].name} — ${formatRate(US_STATE_RATES[s].bps)}` }))}
            onChange={(usState) => onChange((c) => ({ ...c, usState }))}
          />
        )}
        {config.region === "UK" && (
          <p className="text-xs text-muted">VAT per line: 20% standard, 5% reduced and 0% zero-rated items, with a breakdown per rate.</p>
        )}
        {config.region === "PK" && <p className="text-xs text-muted">General Sales Tax at the standard 18% rate.</p>}
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-navy">Line items per invoice</legend>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Min" value={config.lines.min} min={1} max={20} onChange={(min) => onChange((c) => ({ ...c, lines: { ...c.lines, min } }))} />
            <NumberField label="Max" value={config.lines.max} min={1} max={20} onChange={(max) => onChange((c) => ({ ...c, lines: { ...c.lines, max } }))} />
          </div>
        </fieldset>
        <SelectField
          label="Payment terms"
          value={String(config.paymentTermsDays)}
          options={TERMS.map((t) => ({ value: String(t), label: `Net ${t} days` }))}
          onChange={(v) => onChange((c) => ({ ...c, paymentTermsDays: Number(v) as InvoiceConfig["paymentTermsDays"] }))}
        />
      </div>
    </Card>
  );
}

function StatementSettings({
  config,
  onChange,
  currencySymbolHint,
}: {
  config: StatementConfig;
  onChange: (config: StatementConfig) => void;
  currencySymbolHint: string;
}) {
  const [query, setQuery] = useState(QUERY_EXAMPLES[0]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>(["90 days", "balance ≥ 500"]);

  const apply = (text: string) => {
    const result = parseStatementQuery(text, config);
    if (!result.ok) {
      setQueryError(result.error);
      return;
    }
    setQueryError(null);
    setChips(result.chips);
    onChange(result.config);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    apply(query);
  };

  const manual = (next: StatementConfig) => {
    setChips([]);
    onChange(next);
  };

  return (
    <>
      <Card title="Describe the statement" description="Plain-language request, parsed into constraints.">
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="stmt-query" className="sr-only">
            Statement request
          </label>
          <div className="flex gap-2">
            <input
              id="stmt-query"
              className={inputClass}
              value={query}
              maxLength={200}
              aria-invalid={queryError ? true : undefined}
              aria-describedby="stmt-query-msg"
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm">
              Apply
            </Button>
          </div>
          <p id="stmt-query-msg" className={cx("text-xs", queryError ? "text-danger" : "text-muted")} role={queryError ? "alert" : undefined}>
            {queryError ?? "Amounts are in the selected currency (" + currencySymbolHint + ")."}
          </p>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1" aria-label="Parsed constraints">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {QUERY_EXAMPLES.slice(1).map((ex) => (
              <button
                key={ex}
                type="button"
                className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-muted hover:border-teal hover:text-teal"
                onClick={() => {
                  setQuery(ex);
                  apply(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </Card>
      <Card title="Statement settings" description="Fine-tune the constraints directly.">
        <div className="space-y-3">
          <NumberField label="Window (days)" value={config.days} min={7} max={MAX_STATEMENT_DAYS} onChange={(days) => manual({ ...config, days })} />
          <Toggle
            label="Exact transaction count"
            checked={config.transactions !== null}
            onChange={(on) => manual({ ...config, transactions: on ? 40 : null })}
          />
          {config.transactions !== null && (
            <NumberField
              label="Transactions"
              value={config.transactions}
              min={5}
              max={MAX_TRANSACTIONS}
              onChange={(transactions) => manual({ ...config, transactions })}
            />
          )}
          <Toggle label="Minimum balance" checked={config.minBalance !== null} onChange={(on) => manual({ ...config, minBalance: on ? 500 : null })} />
          {config.minBalance !== null && (
            <NumberField
              label="Balance stays at or above"
              value={config.minBalance}
              min={-1e7}
              max={1e8}
              integer={false}
              onChange={(minBalance) => manual({ ...config, minBalance })}
            />
          )}
          <Toggle label="Maximum balance" checked={config.maxBalance !== null} onChange={(on) => manual({ ...config, maxBalance: on ? 5000 : null })} />
          {config.maxBalance !== null && (
            <NumberField
              label="Balance stays at or below"
              value={config.maxBalance}
              min={-1e7}
              max={1e8}
              integer={false}
              onChange={(maxBalance) => manual({ ...config, maxBalance })}
            />
          )}
        </div>
      </Card>
    </>
  );
}
