"use client";

import { useState } from "react";
import { Button, Card, Chip, cx } from "@/components/ui/controls";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import type { ValidationReport } from "@/lib/engines/relational/validate";

export function ValidationPanel({
  report,
  onTamperTest,
}: {
  report: ValidationReport;
  onTamperTest: () => { caught: number; injected: string[]; report: ValidationReport };
}) {
  const [tamper, setTamper] = useState<{ caught: number; injected: string[]; report: ValidationReport } | null>(null);

  return (
    <Card
      title="Validation"
      description="Every key, total and cardinality is re-checked from the generated rows."
      actions={
        <Chip tone={report.ok ? "mint" : "danger"}>
          {report.ok ? <CheckIcon width={14} height={14} /> : <AlertIcon width={14} height={14} />}
          {report.ok ? "All checks pass" : "Problems found"}
        </Chip>
      }
    >
      <p className="mb-3 font-display text-lg font-semibold text-navy" aria-live="polite">
        {report.orphans} orphans · {report.mismatches} mismatches · {report.duplicates} duplicate keys
      </p>
      <details key={report.ok ? "ok" : "failing"} open={!report.ok} className="group">
        <summary className="mb-2 cursor-pointer text-xs font-medium text-teal select-none hover:underline">
          {report.checks.length} checks: {report.checks.filter((c) => c.violations === 0).length} passed
        </summary>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {report.checks.map((check) => {
            const pass = check.violations === 0;
            return (
              <li
                key={check.id}
                className={cx(
                  "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                  pass ? "bg-mint/50 text-ink" : "bg-danger-soft text-danger",
                )}
              >
                <span className={cx("mt-0.5 shrink-0", pass ? "text-teal" : "text-danger")}>
                  {pass ? <CheckIcon width={14} height={14} /> : <AlertIcon width={14} height={14} />}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{check.label}</span>
                  {!pass && (
                    <span className="block">
                      {check.violations} violation{check.violations === 1 ? "" : "s"}: {check.examples.join("; ")}
                    </span>
                  )}
                </span>
            </li>
          );
        })}
      </ul>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <Button size="sm" onClick={() => setTamper(onTamperTest())}>
          Run tamper test
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted">
          Injects broken rows into a copy of the data to prove the validator catches them. Exports are never affected.
        </p>
      </div>
      {tamper && (
        <div className="mt-3 rounded-xl border border-line bg-white p-3 text-xs" role="status">
          <p className="font-medium text-navy">
            Validator caught {tamper.caught} of {tamper.injected.length} injected problems:{" "}
            {tamper.report.orphans} orphans · {tamper.report.mismatches} mismatches · {tamper.report.duplicates} duplicate keys.
          </p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {tamper.injected.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
