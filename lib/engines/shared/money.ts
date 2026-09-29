import type { CurrencyCode, LocaleId } from "./locales";

/**
 * Money is always held as integer minor units (cents, pence, paisa).
 * Floats are only produced at the display/export boundary.
 */

const EXPONENT: Record<CurrencyCode, number> = { USD: 2, GBP: 2, EUR: 2, PKR: 2 };

export function currencyExponent(currency: CurrencyCode): number {
  return EXPONENT[currency];
}

export function toMinor(major: number, currency: CurrencyCode): number {
  const factor = 10 ** currencyExponent(currency);
  return Math.round(major * factor);
}

export function fromMinor(minor: number, currency: CurrencyCode): number {
  const exp = currencyExponent(currency);
  return Number((minor / 10 ** exp).toFixed(exp));
}

/** Plain decimal string for CSV/SQL, e.g. 48210 → "482.10". */
export function minorToDecimalString(minor: number, currency: CurrencyCode): string {
  const exp = currencyExponent(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(minor)).toString().padStart(exp + 1, "0");
  return exp === 0 ? `${sign}${abs}` : `${sign}${abs.slice(0, -exp)}.${abs.slice(-exp)}`;
}

/**
 * Applies a percentage rate expressed in basis points (7.25% = 725) to an amount
 * in minor units, rounding half away from zero to the nearest minor unit.
 */
export function applyRateBps(amountMinor: number, rateBps: number): number {
  const product = amountMinor * rateBps;
  const sign = product < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(product) + 5000) / 10000);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: CurrencyCode, locale: LocaleId): string {
  const key = `${locale}|${currency}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    const exp = currencyExponent(currency);
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    });
    formatterCache.set(key, fmt);
  }
  return fmt.format(fromMinor(minor, currency));
}
