import Link from "next/link";
import { LandingLogo } from "./LandingLogo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <LandingLogo size={28} />
          <div>
            <p className="font-display text-sm font-semibold text-navy">Zero Real</p>
            <p className="text-xs text-muted">Realistic data, zero real records.</p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-6 text-sm text-muted">
          <a href="#features" className="hover:text-navy">Features</a>
          <a href="#how-it-works" className="hover:text-navy">How it works</a>
          <Link href="/app" className="hover:text-navy">Launch app</Link>
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Zero Real</p>
      </div>
    </footer>
  );
}
