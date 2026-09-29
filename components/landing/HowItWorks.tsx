import { Reveal, Stagger, StaggerItem } from "./motion";

const STEPS = [
  { n: 1, title: "Ingest schema", body: "Define columns and types by hand, or let AI infer them from a sample." },
  { n: 2, title: "Model relationships", body: "Set distributions and foreign-key cardinalities across tables." },
  { n: 3, title: "Generate with AI", body: "Fill in realistic names, text and edge cases the schema can't describe." },
  { n: 4, title: "Validate & export", body: "Check integrity and totals, then export CSV, JSON, SQL or PDF." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-navy sm:text-4xl">From schema to shippable data</h2>
          <p className="mt-4 text-lg text-muted">A schema-aware pipeline — the same four steps power every engine.</p>
        </Reveal>

        <Stagger className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-4">
          <div className="absolute top-5 right-0 left-0 hidden h-px bg-line md:block" aria-hidden="true" />
          {STEPS.map((s) => (
            <StaggerItem key={s.n} className="relative flex flex-col items-center text-center md:items-start md:text-left">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-teal font-display text-base font-bold text-white ring-4 ring-cream">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-1.5 max-w-xs text-sm text-muted">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
