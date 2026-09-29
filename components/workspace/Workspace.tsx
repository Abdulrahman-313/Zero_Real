"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { NoticeProvider } from "@/components/ui/notices";
import { DEFAULT_SETTINGS, type GlobalSettings } from "@/lib/engines/shared/locales";
import { DocumentsMode } from "./documents/DocumentsMode";
import { isModeId, type ModeId } from "./modes";
import { RelationalMode } from "./relational/RelationalMode";
import { Sidebar } from "./Sidebar";
import { TabularMode } from "./tabular/TabularMode";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHashMode(): ModeId {
  const hash = window.location.hash.replace(/^#/, "");
  return isModeId(hash) ? hash : "tabular";
}

/** The active mode lives in the URL hash so it survives reloads and can be linked. */
function useHashMode(): [ModeId, (mode: ModeId) => void] {
  const mode = useSyncExternalStore(subscribeToHash, readHashMode, () => "tabular" as const);
  const setMode = useCallback((next: ModeId) => {
    if (window.location.hash !== `#${next}`) window.location.hash = next;
  }, []);
  return [mode, setMode];
}

const noopSubscribe = () => () => {};

/** False during prerender and hydration, true afterwards. Generation is client-only. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function Workspace() {
  const [mode, setMode] = useHashMode();
  const hydrated = useHydrated();
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);

  // All modes stay mounted so their configuration survives tab switches;
  // inactive ones are removed from layout and the accessibility tree.
  const slot = (id: ModeId) => (id === mode ? "contents" : "hidden");

  return (
    <NoticeProvider>
      <a
        href={`#preview-${mode}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(`preview-${mode}`)?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-teal px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to preview
      </a>
      <div className="workspace-grid flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[15.5rem_minmax(0,1fr)_23rem] lg:grid-rows-[minmax(0,1fr)_auto]">
        <Sidebar mode={mode} onModeChange={setMode} />
        <div className={slot("tabular")}>
          <TabularMode active={hydrated && mode === "tabular"} settings={settings} onSettingsChange={setSettings} />
        </div>
        <div className={slot("relational")}>
          <RelationalMode active={hydrated && mode === "relational"} settings={settings} onSettingsChange={setSettings} />
        </div>
        <div className={slot("documents")}>
          <DocumentsMode active={hydrated && mode === "documents"} settings={settings} onSettingsChange={setSettings} />
        </div>
      </div>
    </NoticeProvider>
  );
}
