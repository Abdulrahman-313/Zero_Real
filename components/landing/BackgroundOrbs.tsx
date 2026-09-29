"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight decorative background: three blurred teal/navy orbs animated with
 * pure CSS transforms (GPU-composited). Lazy-mounted after first idle so it never
 * blocks paint, paused whenever it scrolls out of view, capped on mobile, and
 * fully disabled under prefers-reduced-motion (handled in globals.css).
 */
export function BackgroundOrbs() {
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as typeof window & { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => setMounted(true));
    else window.setTimeout(() => setMounted(true), 200);
  }, []);

  useEffect(() => {
    if (!mounted || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mounted]);

  return (
    <div ref={ref} aria-hidden="true" data-paused={paused} className="zr-orbs pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {mounted && (
        <>
          <span
            className="zr-orb absolute -top-24 -left-16 h-72 w-72 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(28,124,108,0.28), transparent 70%)", ["--dx" as string]: "40px", ["--dy" as string]: "30px", ["--dur" as string]: "19s" }}
          />
          <span
            className="zr-orb absolute top-10 right-[-6rem] h-80 w-80 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(15,42,63,0.18), transparent 70%)", ["--dx" as string]: "-36px", ["--dy" as string]: "44px", ["--dur" as string]: "23s" }}
          />
          <span
            className="zr-orb absolute bottom-[-8rem] left-1/3 hidden h-72 w-72 rounded-full opacity-50 blur-3xl sm:block"
            style={{ background: "radial-gradient(circle, rgba(220,237,233,0.6), transparent 70%)", ["--dx" as string]: "28px", ["--dy" as string]: "-32px", ["--dur" as string]: "27s" }}
          />
        </>
      )}
    </div>
  );
}
