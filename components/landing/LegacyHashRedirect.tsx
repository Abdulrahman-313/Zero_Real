"use client";

import { useEffect } from "react";
import { isModeId } from "@/components/workspace/modes";

/**
 * The tool used to live at `/` with the active engine in the URL hash
 * (e.g. `/#relational`). It now lives at `/app`. Hashes never reach the server,
 * so this client-side redirect preserves old bookmarks: `/#relational` → `/app#relational`.
 */
export function LegacyHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (isModeId(hash)) window.location.replace(`/app#${hash}`);
  }, []);
  return null;
}
