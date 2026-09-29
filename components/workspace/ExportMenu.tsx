"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, cx } from "@/components/ui/controls";
import { ChevronDownIcon, DownloadIcon } from "@/components/ui/icons";
import { useNotify } from "@/components/ui/notices";

export interface ExportOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  run: () => void | Promise<void>;
}

export function ExportMenu({
  options,
  disabled,
  disabledReason,
  summary,
}: {
  options: ExportOption[];
  disabled?: boolean;
  disabledReason?: string;
  summary?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const notify = useNotify();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("[data-export-trigger]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-export-item]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (option: ExportOption) => {
    setBusy(option.id);
    setOpen(false);
    try {
      // Yield so the busy state paints before heavy synchronous generation.
      await new Promise((resolve) => setTimeout(resolve, 16));
      await option.run();
    } catch (error) {
      notify({
        tone: "error",
        message: `Export failed: ${error instanceof Error ? error.message : "unexpected error"}.`,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        {summary && <div className="min-w-0 text-xs text-muted">{summary}</div>}
        <Button
          variant="primary"
          data-export-trigger
          className={cx("min-w-36", !summary && "w-full")}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={disabled || busy !== null}
          title={disabled ? disabledReason : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <DownloadIcon width={18} height={18} />
          {busy ? "Preparing…" : "Export"}
          <ChevronDownIcon width={16} height={16} className={cx("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      {disabled && disabledReason && <p className="mt-1.5 text-xs text-danger">{disabledReason}</p>}
      {open && (
        <div
          id={menuId}
          className="absolute right-0 bottom-full z-40 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper p-1.5 shadow-xl"
        >
          <ul className="space-y-0.5">
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  data-export-item
                  onClick={() => run(option)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-mint/70 focus:bg-mint/70 focus:outline-none"
                >
                  <span className="mt-0.5 text-teal">{option.icon ?? <DownloadIcon width={18} height={18} />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-navy">{option.label}</span>
                    {option.description && <span className="block text-xs text-muted">{option.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
