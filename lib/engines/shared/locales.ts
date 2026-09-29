import { z } from "zod";

export const LOCALE_IDS = ["en-US", "en-GB", "de-DE", "en-PK"] as const;
export const CURRENCY_CODES = ["USD", "GBP", "EUR", "PKR"] as const;

export type LocaleId = (typeof LOCALE_IDS)[number];
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface LocaleInfo {
  id: LocaleId;
  label: string;
  defaultCurrency: CurrencyCode;
  country: string;
}

export const LOCALES: Record<LocaleId, LocaleInfo> = {
  "en-US": { id: "en-US", label: "English (US)", defaultCurrency: "USD", country: "United States" },
  "en-GB": { id: "en-GB", label: "English (UK)", defaultCurrency: "GBP", country: "United Kingdom" },
  "de-DE": { id: "de-DE", label: "Deutsch (DE)", defaultCurrency: "EUR", country: "Germany" },
  "en-PK": { id: "en-PK", label: "English (PK)", defaultCurrency: "PKR", country: "Pakistan" },
};

export const CURRENCIES: Record<CurrencyCode, { code: CurrencyCode; label: string }> = {
  USD: { code: "USD", label: "US dollar (USD)" },
  GBP: { code: "GBP", label: "British pound (GBP)" },
  EUR: { code: "EUR", label: "Euro (EUR)" },
  PKR: { code: "PKR", label: "Pakistani rupee (PKR)" },
};

export const MAX_SEED = 2_147_483_647;

export const globalSettingsSchema = z.object({
  seed: z.number().int().min(0).max(MAX_SEED),
  locale: z.enum(LOCALE_IDS),
  currency: z.enum(CURRENCY_CODES),
});

export type GlobalSettings = z.infer<typeof globalSettingsSchema>;

export const DEFAULT_SETTINGS: GlobalSettings = { seed: 42, locale: "en-US", currency: "USD" };
