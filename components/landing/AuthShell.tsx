import Link from "next/link";
import type { ReactNode } from "react";
import { BackgroundOrbs } from "./BackgroundOrbs";
import { LandingLogo } from "./LandingLogo";

/** Centered auth layout with the landing's animated background behind the Clerk card. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-cream px-4 py-12">
      <BackgroundOrbs />
      <Link href="/" className="mb-8 flex items-center gap-2.5" aria-label="Zero Real home">
        <LandingLogo />
        <span className="font-display text-lg font-semibold text-navy">Zero Real</span>
      </Link>
      {children}
      <Link href="/" className="mt-8 text-xs text-muted hover:text-navy">
        ← Back to home
      </Link>
    </main>
  );
}
