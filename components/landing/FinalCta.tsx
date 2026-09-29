import Link from "next/link";

export function FinalCta() {
  return (
    <section className="bg-cream px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-navy px-8 py-14 text-center text-paper sm:px-14">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Generate your first dataset in seconds</h2>
        <p className="mx-auto mt-4 max-w-xl text-paper/70">
          Open the workspace, pick an engine, and export realistic data — CSV, JSON, SQL or PDF. No real records involved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/app" className="rounded-xl bg-teal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-dark">
            Launch app
          </Link>
          <a href="#features" className="rounded-xl border border-paper/25 px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-navy-600">
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
}
