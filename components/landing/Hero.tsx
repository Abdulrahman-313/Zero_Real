import Link from "next/link";
import { SparkleIcon } from "@/components/ui/icons";
import { WorkspaceMock } from "./WorkspaceMock";

export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pt-20 lg:pb-24">
      <div className="max-w-xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-teal-dark">
          <SparkleIcon width={14} height={14} /> Synthetic data platform
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.08] font-bold tracking-tight text-navy sm:text-5xl lg:text-[3.4rem]">
          Realistic, privacy-safe data — generated on demand
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Zero Real produces tabular, relational and document data that looks real, links up correctly and always adds up —
          without ever touching a real record.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/app" className="rounded-xl bg-teal px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-dark">
            Launch app
          </Link>
          <a href="#features" className="rounded-xl border border-line bg-paper px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-mint/60">
            See features
          </a>
        </div>
        <p className="mt-5 text-xs text-muted">No sign-up to explore the demo data · Runs in your browser · Export to CSV, JSON, SQL & PDF</p>
      </div>

      <div className="lg:pl-4">
        <WorkspaceMock />
      </div>
    </section>
  );
}
