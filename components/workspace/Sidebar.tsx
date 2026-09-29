"use client";

import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { cx } from "@/components/ui/cx";
import { DocumentIcon, RelationsIcon, TableIcon } from "@/components/ui/icons";
import { MODES, PIPELINE_STEPS, type ModeId } from "./modes";

const modeIcon: Record<ModeId, ReactNode> = {
  tabular: <TableIcon />,
  relational: <RelationsIcon />,
  documents: <DocumentIcon />,
};

export function Sidebar({ mode, onModeChange }: { mode: ModeId; onModeChange: (mode: ModeId) => void }) {
  return (
    <header className="no-print order-1 bg-navy text-paper lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:overflow-y-auto">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 lg:px-5 lg:pt-6 lg:pb-6">
        <LogoMark />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-tight font-semibold">Zero Real</p>
          <p className="text-xs text-mint/80">Synthetic data platform</p>
        </div>
        <UserButton />
      </div>

      <nav aria-label="Data type" className="px-2 pb-2 lg:px-3">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {MODES.map((m) => {
            const active = m.id === mode;
            return (
              <li key={m.id} className="shrink-0 lg:shrink">
                <a
                  href={`#${m.id}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onModeChange(m.id);
                  }}
                  className={cx(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:py-2.5",
                    active ? "bg-teal text-white" : "text-paper/80 hover:bg-navy-600 hover:text-white",
                  )}
                >
                  {modeIcon[m.id]}
                  <span>{m.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="pipeline-heading" className="mt-auto hidden px-5 pt-8 pb-6 lg:block">
        <h2 id="pipeline-heading" className="mb-3 text-xs font-semibold tracking-wider text-mint/70 uppercase">
          Pipeline
        </h2>
        <ol className="space-y-3">
          {PIPELINE_STEPS.map((step, i) => (
            <li key={step.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-600 text-xs font-semibold text-mint"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-tight font-medium text-paper">{step.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-paper/60">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-xl bg-navy-700 px-3 py-2 text-xs leading-snug text-paper/70">
          Everything is generated in your browser. No real records are used or uploaded.
        </p>
      </section>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#173A55" />
      <rect x="14" y="16" width="36" height="8" rx="3" fill="#1C7C6C" />
      <rect x="14" y="28" width="24" height="8" rx="3" fill="#DCEDE9" />
      <rect x="14" y="40" width="30" height="8" rx="3" fill="#DCEDE9" opacity="0.65" />
      <circle cx="47" cy="44" r="6" fill="#1C7C6C" />
    </svg>
  );
}
