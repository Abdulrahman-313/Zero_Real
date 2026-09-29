import { CheckIcon } from "@/components/ui/icons";

const REASONS = [
  { title: "One schema-aware pipeline", body: "Tabular, relational and document generators share the same engine, so the data is consistent across all three." },
  { title: "Correct by construction", body: "Foreign keys resolve, invoice totals reconcile, and balances always add up — then an independent validator re-checks it." },
  { title: "Solves data scarcity & privacy", body: "Get as much realistic test data as you need without waiting on sign-off or exposing a single real record." },
  { title: "AI that never breaks the flow", body: "The AI is grounded by your sample and falls back to built-in rules on any error — the tool never hangs or crashes." },
  { title: "Built for testing", body: "Deliberately inject nulls, outliers, unicode and boundary values so your software meets the hard cases early." },
  { title: "No code, fully exportable", body: "Configure everything in one workspace and export to the format your stack already speaks." },
];

export function WhyItWins() {
  return (
    <section id="why" className="scroll-mt-20 bg-paper py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-navy sm:text-4xl">Built for engineers who need data now</h2>
          <p className="mt-4 text-lg text-muted">Realistic where it helps, strict where it matters.</p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title} className="rounded-2xl border border-line bg-cream/50 p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-teal-dark">
                <CheckIcon width={16} height={16} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-navy">{r.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
