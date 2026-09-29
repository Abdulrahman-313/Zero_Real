"use client";

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export { cx };

export function Card({
  title,
  description,
  actions,
  children,
  className,
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  const headingId = useId();
  return (
    <Tag
      aria-labelledby={title ? headingId : undefined}
      className={cx("rounded-2xl border border-line bg-paper p-4 shadow-sm", className)}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-sm font-semibold text-navy">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-teal text-white hover:bg-teal-dark disabled:bg-teal/50",
  secondary: "border border-line bg-white text-navy hover:bg-mint/60 disabled:text-muted",
  ghost: "text-navy hover:bg-mint/70 disabled:text-muted",
  danger: "text-danger hover:bg-danger-soft disabled:text-muted",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "icon" }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "sm" && "px-2.5 py-1.5 text-xs",
        size === "icon" && "h-8 w-8 text-sm",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Chip({
  children,
  tone = "mint",
  className,
}: {
  children: ReactNode;
  tone?: "mint" | "navy" | "warn" | "danger" | "neutral";
  className?: string;
}) {
  const tones = {
    mint: "bg-mint text-teal-dark",
    navy: "bg-navy text-paper",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-cream text-muted",
  } as const;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink shadow-inner shadow-black/[0.02] placeholder:text-muted/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 aria-[invalid=true]:border-danger";

export { inputClass };

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-navy">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  integer = true,
  hint,
  suffix,
  className,
}: {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  hint?: ReactNode;
  suffix?: string;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  const parse = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return integer ? Math.trunc(n) : n;
  };
  const parsed = draft === null ? value : parse(draft);
  const error =
    draft === null
      ? null
      : parsed === null
        ? "Enter a number."
        : parsed < min || parsed > max
          ? `Must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`
          : null;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          className={cx(inputClass, suffix && "pr-9")}
          value={shown}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = parse(raw);
            if (n !== null && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => {
            if (draft === null) return;
            const n = parse(draft);
            if (n !== null) onChange(Math.min(max, Math.max(min, n)));
            setDraft(null);
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} className={className}>
      <select
        id={id}
        className={inputClass}
        value={value}
        aria-describedby={hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  className,
  maxLength,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        type="text"
        className={inputClass}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <span id={`${id}-label`} className="text-xs font-medium text-navy">
          {label}
        </span>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-teal" : "bg-line",
        )}
      >
        <span
          className={cx(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx("inline-flex flex-wrap gap-1 rounded-xl bg-cream p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
