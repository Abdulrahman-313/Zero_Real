"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Route-transition wrapper (App Router re-mounts template.tsx on navigation).
 * The app route animates OPACITY ONLY — a transform on an ancestor creates a
 * containing block that would break the workspace's fixed toasts and sticky panels.
 * The landing gets a subtle fade + slide.
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const isApp = pathname?.startsWith("/app");

  if (reduce) return <>{children}</>;

  if (isApp) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
