import Link from "next/link";
import { LegacyHashRedirect } from "@/components/landing/LegacyHashRedirect";

// Temporary landing placeholder (replaced by the full marketing page in M2).
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream p-6 text-center">
      <LegacyHashRedirect />
      <h1 className="font-display text-4xl font-bold text-navy">Zero Real</h1>
      <p className="mt-2 max-w-md text-muted">
        Realistic, privacy-safe tabular, relational and document data — generated on demand.
      </p>
      <Link
        href="/app"
        className="mt-6 rounded-xl bg-teal px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-dark"
      >
        Launch app
      </Link>
    </main>
  );
}
