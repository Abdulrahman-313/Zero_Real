import type { CurrencyCode, LocaleId } from "../shared/locales";
import type { UkVatBand } from "./pools";

export const REGIONS = ["US", "UK", "PK"] as const;
export type Region = (typeof REGIONS)[number];

export const US_STATES = ["CA", "NY", "TX", "WA", "FL", "IL", "OR"] as const;
export type UsState = (typeof US_STATES)[number];

/** State-level base sales tax rates in basis points (local surtaxes not modelled). */
export const US_STATE_RATES: Record<UsState, { name: string; bps: number }> = {
  CA: { name: "California", bps: 725 },
  NY: { name: "New York", bps: 400 },
  TX: { name: "Texas", bps: 625 },
  WA: { name: "Washington", bps: 650 },
  FL: { name: "Florida", bps: 600 },
  IL: { name: "Illinois", bps: 625 },
  OR: { name: "Oregon", bps: 0 },
};

export const UK_VAT_BPS: Record<UkVatBand, number> = { standard: 2000, reduced: 500, zero: 0 };
export const PK_GST_BPS = 1800;

export interface RegionTemplate {
  region: Region;
  label: string;
  taxLabel: string;
  /** Explicit date pattern for invoices (tokens YYYY, MM, DD). */
  datePattern: string;
  currency: CurrencyCode;
  locale: LocaleId;
  taxIdLabel: string;
}

export const REGION_TEMPLATES: Record<Region, RegionTemplate> = {
  US: { region: "US", label: "United States — Sales tax", taxLabel: "Sales Tax", datePattern: "MM/DD/YYYY", currency: "USD", locale: "en-US", taxIdLabel: "EIN" },
  UK: { region: "UK", label: "United Kingdom — VAT", taxLabel: "VAT", datePattern: "DD/MM/YYYY", currency: "GBP", locale: "en-GB", taxIdLabel: "VAT reg. no." },
  PK: { region: "PK", label: "Pakistan — GST", taxLabel: "GST", datePattern: "DD-MM-YYYY", currency: "PKR", locale: "en-PK", taxIdLabel: "NTN" },
};

export function formatRate(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}
