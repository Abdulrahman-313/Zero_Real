import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream p-6">
      <div className="max-w-md rounded-2xl border border-line bg-paper p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Page not found</h1>
        <p className="mt-2 text-sm text-muted">There is nothing at this address. The workspace lives on the home page.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-dark">
          Open the workspace
        </Link>
      </div>
    </main>
  );
}
