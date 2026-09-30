import type { ReactNode } from "react";
import { CheckIcon, DocumentIcon, DownloadIcon, RelationsIcon, SparkleIcon, TableIcon } from "@/components/ui/icons";
import { Reveal, Stagger, StaggerItem } from "./motion";

interface Feature {
  icon: ReactNode;
  title: string;
  blurb: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    icon: <TableIcon width={22} height={22} />,
    title: "Tabular",
    blurb: "Rows from a column schema, with realistic types and per-column privacy.",
    points: ["9 column types incl. id, email, currency, category", "Null & outlier rates, seeded and reproducible", "Mask, SHA-256 hash or numeric noise per column"],
  },
  {
    icon: <RelationsIcon width={22} height={22} />,
    title: "Relational",
    blurb: "Linked tables that keep their integrity, automatically.",
    points: ["Customers → orders → items, with 1:1, 1:N and N:N", "0 orphans — every foreign key resolves", "Order totals always equal their line items"],
  },
  {
    icon: <DocumentIcon width={22} height={22} />,
    title: "Documents",
    blurb: "Invoices and bank statements that always reconcile.",
    points: ["Regional tax: US sales tax, UK VAT, PK GST", "Bank statements with a correct running balance", "Clearly labelled synthetic — print or save as PDF"],
  },
];

const AI_ITEMS = [
  { title: "Infer schema", body: "Paste a small CSV or JSON sample and the AI works out the column types and keys, then fills the config." },
  { title: "Realistic text", body: "Generate believable product descriptions, memos and notes as reusable, seeded pools." },
  { title: "Edge-case ideas", body: "Get suggestions for the tricky values worth testing — nulls, unicode, boundaries — and toggle them on." },
];

const TRUST = [
  { title: "Privacy-safe", body: "No real records, ever. Invented names and reserved example.com domains." },
  { title: "Seeded & reproducible", body: "The same seed always produces the exact same data." },
  { title: "Exportable", body: "Download CSV, JSON, a Postgres SQL dump, or a printable PDF." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-paper py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-navy sm:text-4xl">Three engines, one workspace</h2>
          <p className="mt-4 text-lg text-muted">Configure, preview and export — no code required. Everything runs in your browser.</p>
        </Reveal>

        <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <article className="h-full rounded-2xl border border-line bg-cream/50 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-paper">{f.icon}</div>
                <h3 className="mt-4 font-display text-xl font-semibold text-navy">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.blurb}</p>
                <ul className="mt-4 space-y-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-ink">
                      <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-teal" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-6 overflow-hidden rounded-2xl border border-line bg-navy p-8 text-paper">
          <div className="flex items-center gap-2">
            <SparkleIcon width={20} height={20} className="text-mint" />
            <h3 className="font-display text-xl font-semibold">An AI-assisted schema workflow</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-paper/70">
            In the tabular workspace, Google Gemini speeds up setup — with an automatic rule-based fallback, so it stays fast and never hangs, even offline.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {AI_ITEMS.map((a) => (
              <div key={a.title} className="rounded-xl bg-navy-700 p-4">
                <p className="font-medium text-mint">{a.title}</p>
                <p className="mt-1 text-sm text-paper/70">{a.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Stagger className="mt-6 grid gap-4 sm:grid-cols-3">
          {TRUST.map((tItem) => (
            <StaggerItem key={tItem.title}>
              <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-cream/50 p-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint text-teal-dark">
                  {tItem.title === "Exportable" ? <DownloadIcon width={16} height={16} /> : <CheckIcon width={16} height={16} />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">{tItem.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{tItem.body}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
