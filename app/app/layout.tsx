"use client";

import { useEffect } from "react";

/**
 * The workspace is a fixed-viewport app shell on desktop; each panel scrolls
 * internally. Lock the window scroll there so a phantom scroll-height can never
 * expose blank space below the shell. Restored on unmount (e.g. back to the
 * landing, which does scroll) and disabled on mobile, where the page flows.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const lock = desktop.matches;
      root.style.overflow = lock ? "hidden" : "";
      body.style.overflow = lock ? "hidden" : "";
    };
    apply();
    desktop.addEventListener("change", apply);
    return () => {
      root.style.overflow = "";
      body.style.overflow = "";
      desktop.removeEventListener("change", apply);
    };
  }, []);

  return children;
}
