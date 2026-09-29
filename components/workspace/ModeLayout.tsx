import type { ReactNode } from "react";

/**
 * Places a mode's preview, configuration and export bar into the workspace grid.
 * Desktop: sidebar | preview | config (export pinned under config).
 * Mobile: nav → config → preview → sticky export bar.
 */
export function ModeLayout({
  mode,
  title,
  summary,
  headerExtra,
  preview,
  config,
  exportBar,
}: {
  mode: string;
  title: string;
  summary: string;
  headerExtra?: ReactNode;
  preview: ReactNode;
  config: ReactNode;
  exportBar: ReactNode;
}) {
  return (
    <>
      <main
        id={`preview-${mode}`}
        tabIndex={-1}
        className="order-3 min-w-0 flex-1 px-4 py-5 focus:outline-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-y-auto lg:px-8 lg:py-7"
      >
        <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-navy lg:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-muted">{summary}</p>
          </div>
          {headerExtra}
        </div>
        {preview}
      </main>

      <aside
        aria-label={`${title} configuration`}
        className="no-print order-2 border-line bg-cream px-4 pt-2 pb-4 lg:col-start-3 lg:row-start-1 lg:overflow-y-auto lg:border-l lg:bg-[#EBE8DE] lg:px-4 lg:pt-6"
      >
        <div className="space-y-4">{config}</div>
      </aside>

      <section
        aria-label={`${title} export`}
        className="no-print sticky bottom-0 z-30 order-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:col-start-3 lg:row-start-2 lg:border-l"
      >
        {exportBar}
      </section>
    </>
  );
}
