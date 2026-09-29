"use client";

import { useEffect, useId, useState } from "react";
import { Button, Card, Chip, Toggle, cx, inputClass } from "@/components/ui/controls";
import { SparkleIcon } from "@/components/ui/icons";
import { useNotify } from "@/components/ui/notices";
import { AiInputError, callAi, fetchAiStatus } from "@/lib/ai/client";
import { MAX_SAMPLE_BYTES, MAX_SAMPLE_ROWS, type AiProviderName, type EdgeCaseSuggestion } from "@/lib/ai/schemas";
import { EXAMPLE_SAMPLE, inferredToColumns } from "@/lib/ai/toColumns";
import { COLUMN_TYPE_LABELS } from "@/lib/engines/tabular/columns";
import { EDGE_CASES } from "@/lib/engines/tabular/edgeCases";
import type { Column, EdgeCaseKind, TabularConfig } from "@/lib/engines/tabular/schema";

function ProviderBadge({ provider }: { provider: AiProviderName }) {
  return provider === "gemini" ? (
    <Chip>
      <SparkleIcon width={12} height={12} /> Gemini
    </Chip>
  ) : (
    <Chip tone="neutral">Built-in rules</Chip>
  );
}

const POOL_SIZE = 20;
let inferRun = 0;

export function AiAssist({
  config,
  onApplyColumns,
  onSetPool,
  onEdgeKinds,
}: {
  config: TabularConfig;
  onApplyColumns: (columns: Column[]) => void;
  onSetPool: (columnName: string, texts: string[] | null) => void;
  onEdgeKinds: (kinds: EdgeCaseKind[]) => void;
}) {
  const notify = useNotify();
  const sampleId = useId();
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [sample, setSample] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [inferError, setInferError] = useState<string | null>(null);
  const [inferred, setInferred] = useState<{ provider: AiProviderName; summary: string[] } | null>(null);
  const [poolProvider, setPoolProvider] = useState<Record<string, AiProviderName>>({});
  const [suggestions, setSuggestions] = useState<{ provider: AiProviderName; items: EdgeCaseSuggestion[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sampleBytes = new TextEncoder().encode(sample).length;
  const tooBig = sampleBytes > MAX_SAMPLE_BYTES;

  const infer = async () => {
    setBusy("infer");
    setInferError(null);
    try {
      const res = await callAi("infer-schema", { sample });
      const columns = inferredToColumns(res.data.columns, `ai-${Date.now().toString(36)}-${inferRun++}`);
      onApplyColumns(columns);
      setInferred({
        provider: res.provider,
        summary: res.data.columns.map((c) => `${c.name}: ${COLUMN_TYPE_LABELS[c.type]}${c.isKey ? " (key)" : ""}`),
      });
      setSuggestions(null);
      notify({
        tone: res.notice ? "warn" : "success",
        message: res.notice ?? `Inferred ${columns.length} columns from ${res.data.rowsAnalyzed} sample rows and applied them.`,
      });
    } catch (error) {
      setInferError(error instanceof AiInputError ? error.message : "Something went wrong while inferring the schema.");
    } finally {
      setBusy(null);
    }
  };

  const textColumns = config.columns.filter((c): c is Extract<Column, { type: "text" }> => c.type === "text");

  const generatePool = async (column: Extract<Column, { type: "text" }>) => {
    setBusy(`pool:${column.id}`);
    try {
      const others = config.columns
        .map((c) => c.name)
        .filter((n) => n !== column.name)
        .join(", ");
      const context = `"${column.name}" column in a dataset with columns ${others}`.slice(0, 200);
      const res = await callAi("synthesize-text", { kind: column.kind, context, count: POOL_SIZE });
      onSetPool(column.name, res.data.texts);
      setPoolProvider((p) => ({ ...p, [column.name]: res.provider }));
      notify({
        tone: res.notice ? "warn" : "success",
        message: res.notice ?? `Generated ${res.data.texts.length} texts for "${column.name}".`,
      });
    } catch (error) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Could not generate text." });
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    setBusy("edge");
    try {
      const columns = config.columns.filter((c) => c.name.trim() !== "").map((c) => ({ name: c.name.trim().slice(0, 64), type: c.type }));
      const res = await callAi("edge-cases", { columns });
      setSuggestions({ provider: res.provider, items: res.data.suggestions });
      notify({
        tone: res.notice ? "warn" : "success",
        message: res.notice ?? `${res.data.suggestions.length} edge-case suggestions ready.`,
      });
    } catch (error) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Could not suggest edge cases." });
    } finally {
      setBusy(null);
    }
  };

  const grouped = new Map<EdgeCaseKind, EdgeCaseSuggestion[]>();
  for (const s of suggestions?.items ?? []) grouped.set(s.kind, [...(grouped.get(s.kind) ?? []), s]);
  const enabled = new Set(config.edgeCases.kinds);

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1.5">
          <SparkleIcon width={16} height={16} className="text-teal" /> AI assist
        </span>
      }
      description={
        status === null
          ? "Schema inference, realistic text and edge-case ideas."
          : status.configured
            ? `Powered by ${status.model}, with automatic fallback to built-in rules.`
            : "No AI key configured. Built-in rules are used and work offline."
      }
    >
      <div className="space-y-5">
        <section aria-labelledby={`${sampleId}-h`} className="space-y-2">
          <h3 id={`${sampleId}-h`} className="text-xs font-semibold text-navy">
            1 · Infer schema from a sample
          </h3>
          <label htmlFor={sampleId} className="sr-only">
            CSV or JSON sample
          </label>
          <textarea
            id={sampleId}
            rows={4}
            className={cx(inputClass, "font-mono text-[11px] leading-snug")}
            placeholder={
              "Paste a CSV (with header) or JSON array, e.g.\nid,name,email,signup,balance\n1,Maria Chen,m.chen@example.com,2025-02-11,482.10"
            }
            value={sample}
            aria-invalid={tooBig || inferError ? true : undefined}
            aria-describedby={`${sampleId}-msg`}
            onChange={(e) => {
              setSample(e.target.value);
              setInferError(null);
            }}
          />
          <p
            id={`${sampleId}-msg`}
            className={cx("text-xs", tooBig || inferError ? "text-danger" : "text-muted")}
            role={inferError ? "alert" : undefined}
          >
            {inferError ??
              (tooBig
                ? `Sample is ${(sampleBytes / 1024).toFixed(1)} KB — the limit is ${MAX_SAMPLE_BYTES / 1024} KB.`
                : `Up to ${MAX_SAMPLE_ROWS} rows / ${MAX_SAMPLE_BYTES / 1024} KB. Only the sample is sent — never generated data.`)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={busy !== null || sample.trim() === "" || tooBig} onClick={infer}>
              {busy === "infer" ? "Inferring…" : "Infer schema"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setSample(EXAMPLE_SAMPLE)}>
              Use example sample
            </Button>
          </div>
          {inferred && (
            <div className="rounded-xl bg-mint/40 p-2.5 text-xs">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-medium text-navy">Applied {inferred.summary.length} columns</span>
                <ProviderBadge provider={inferred.provider} />
              </div>
              <p className="text-muted">{inferred.summary.join(" · ")}</p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-navy">2 · Realistic free text</h3>
          {textColumns.length === 0 ? (
            <p className="text-xs text-muted">Add a Text column (product descriptions, memos, notes) to generate an AI text pool for it.</p>
          ) : (
            <ul className="space-y-2">
              {textColumns.map((c) => {
                const pool = config.textPools[c.name];
                return (
                  <li key={c.id} className="rounded-xl border border-line bg-white p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono font-medium text-navy">{c.name}</span>
                      {pool && poolProvider[c.name] && <ProviderBadge provider={poolProvider[c.name]} />}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Button size="sm" disabled={busy !== null} onClick={() => generatePool(c)}>
                        {busy === `pool:${c.id}` ? "Writing…" : pool ? "Regenerate" : "Generate"}
                      </Button>
                      {pool && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSetPool(c.name, null)}
                          aria-label={`Clear text pool for ${c.name}`}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {pool && (
                      <p className="mt-1.5 line-clamp-2 text-muted" title={pool.join("\n")}>
                        {pool.length} texts, e.g. “{pool[0]}”
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-navy">3 · Edge-case suggestions</h3>
            {suggestions && <ProviderBadge provider={suggestions.provider} />}
          </div>
          <Button size="sm" disabled={busy !== null || config.columns.length === 0} onClick={suggest}>
            {busy === "edge" ? "Thinking…" : suggestions ? "Suggest again" : "Suggest edge cases"}
          </Button>
          {suggestions && grouped.size === 0 && <p className="text-xs text-muted">No applicable edge cases for these column types.</p>}
          {grouped.size > 0 && (
            <ul className="space-y-2.5">
              {[...grouped.entries()].map(([kind, items]) => (
                <li key={kind}>
                  <Toggle
                    label={`${EDGE_CASES[kind].label} · ${items.map((i) => i.column).join(", ")}`}
                    description={items[0].reason}
                    checked={enabled.has(kind)}
                    onChange={(on) =>
                      onEdgeKinds(
                        on ? [...config.edgeCases.kinds.filter((k) => k !== kind), kind] : config.edgeCases.kinds.filter((k) => k !== kind),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
