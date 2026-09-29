import type { LocaleId } from "./locales";

/** Dates are handled as whole UTC day numbers (days since 1970-01-01) to stay timezone-proof. */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isoToDay(value: string): number {
  if (!isValidIsoDate(value)) throw new Error(`Invalid date "${value}" (expected YYYY-MM-DD)`);
  const [y, m, d] = value.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function dayToIso(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function dayToDate(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Locale short date, e.g. 02/11/2025 (en-US), 11/02/2025 (en-GB), 11.02.2025 (de-DE). */
export function formatDay(day: number, locale: LocaleId): string {
  let fmt = dateFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(locale, fmt);
  }
  return fmt.format(dayToDate(day));
}

/** Formats with an explicit pattern using tokens YYYY, MM, DD. */
export function formatDayPattern(day: number, pattern: string): string {
  const [y, m, d] = dayToIso(day).split("-");
  return pattern.replace("YYYY", y).replace("MM", m).replace("DD", d);
}

export function addDays(day: number, delta: number): number {
  return day + delta;
}
