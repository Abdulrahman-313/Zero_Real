"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";
import { cx } from "./controls";

export type NoticeTone = "info" | "success" | "warn" | "error";

interface Notice {
  id: number;
  tone: NoticeTone;
  message: string;
}

type Notify = (notice: { tone?: NoticeTone; message: string }) => void;

const NoticeContext = createContext<Notify>(() => {});

export function useNotify(): Notify {
  return useContext(NoticeContext);
}

const DISMISS_MS = 6000;

const toneStyles: Record<NoticeTone, string> = {
  info: "border-line bg-paper text-ink",
  success: "border-teal/40 bg-mint text-teal-dark",
  warn: "border-warn/30 bg-warn-soft text-warn",
  error: "border-danger/30 bg-danger-soft text-danger",
};

const toneIcon: Record<NoticeTone, ReactNode> = {
  info: <InfoIcon width={18} height={18} />,
  success: <CheckIcon width={18} height={18} />,
  warn: <AlertIcon width={18} height={18} />,
  error: <AlertIcon width={18} height={18} />,
};

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setNotices((list) => list.filter((n) => n.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback<Notify>(
    ({ tone = "info", message }) => {
      const id = nextId.current++;
      setNotices((list) => {
        // Collapse identical consecutive notices and keep the stack short.
        const withoutDupes = list.filter((n) => n.message !== message);
        return [...withoutDupes, { id, tone, message }].slice(-3);
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96 lg:bottom-6"
      >
        {notices.map((n) => (
          <div
            key={n.id}
            className={cx(
              "pointer-events-auto flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg",
              toneStyles[n.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{toneIcon[n.tone]}</span>
            <p className="min-w-0 flex-1">{n.message}</p>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}
