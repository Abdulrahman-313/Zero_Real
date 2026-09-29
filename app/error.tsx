"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream p-6">
      <div className="max-w-md rounded-2xl border border-line bg-paper p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          The workspace hit an unexpected error{error.digest ? ` (reference ${error.digest})` : ""}. Your settings were not sent anywhere.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-dark"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
