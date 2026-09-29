"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { cx } from "@/components/ui/cx";
import { CloseIcon } from "@/components/ui/icons";
import { LandingLogo } from "./LandingLogo";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#why", label: "Why Zero Real" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isSignedIn } = useUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-line bg-paper/85 backdrop-blur" : "border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Zero Real home">
          <LandingLogo />
          <span className="font-display text-lg font-semibold text-navy">Zero Real</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-muted transition-colors hover:text-navy">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isSignedIn ? (
            <>
              <Link href="/app" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark">
                Open app
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-xl px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:bg-mint/70">
                Sign in
              </Link>
              <Link href="/app" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark">
                Launch app
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy hover:bg-mint/70 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <CloseIcon width={22} height={22} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-paper px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-navy hover:bg-mint/60" onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex items-center gap-2">
              {isSignedIn ? (
                <>
                  <Link href="/app" className="flex-1 rounded-xl bg-teal px-4 py-2 text-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                    Open app
                  </Link>
                  <UserButton />
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="flex-1 rounded-xl border border-line px-4 py-2 text-center text-sm font-medium text-navy" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/app" className="flex-1 rounded-xl bg-teal px-4 py-2 text-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                    Launch app
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
