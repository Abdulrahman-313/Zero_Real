import { z } from "zod";
import { isValidIsoDate } from "../shared/dates";
import type { CurrencyCode } from "../shared/locales";
import { REGIONS, US_STATES } from "./tax";

export const MAX_INVOICES = 500;
export const MAX_STATEMENT_DAYS = 365;
export const MAX_TRANSACTIONS = 600;

/** Rough price level per currency so amounts look plausible (1 USD-equivalent). */
export const PRICE_SCALE: Record<CurrencyCode, number> = { USD: 1, GBP: 0.8, EUR: 0.92, PKR: 280 };

export const invoiceConfigSchema = z.object({
  region: z.enum(REGIONS),
  usState: z.enum(US_STATES),
  count: z.number().int().min(1).max(MAX_INVOICES),
  lines: z.object({ min: z.number().int().min(1).max(20), max: z.number().int().min(1).max(20) }),
  paymentTermsDays: z.union([z.literal(7), z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
});

export type InvoiceConfig = z.infer<typeof invoiceConfigSchema>;

export const statementConfigSchema = z.object({
  days: z.number().int().min(7).max(MAX_STATEMENT_DAYS),
  /** Exact number of transactions, or null for a natural volume. */
  transactions: z.number().int().min(5).max(MAX_TRANSACTIONS).nullable(),
  /** Running balance must stay at or above this amount (major units), or null. */
  minBalance: z.number().min(-1e7).max(1e8).nullable(),
  /** Running balance must stay at or below this amount (major units), or null. */
  maxBalance: z.number().min(-1e7).max(1e8).nullable(),
});

export type StatementConfig = z.infer<typeof statementConfigSchema>;

export const documentsConfigSchema = z.object({
  kind: z.enum(["invoice", "statement"]),
  /** Reference "today" so output is reproducible; defaults to the current date in the UI. */
  asOf: z.string().refine(isValidIsoDate, "Use a valid date (YYYY-MM-DD)"),
  invoice: invoiceConfigSchema,
  statement: statementConfigSchema,
});

export type DocumentsConfig = z.infer<typeof documentsConfigSchema>;

export const DEFAULT_INVOICE_CONFIG: InvoiceConfig = {
  region: "US",
  usState: "CA",
  count: 1,
  lines: { min: 2, max: 5 },
  paymentTermsDays: 30,
};

export const DEFAULT_STATEMENT_CONFIG: StatementConfig = {
  days: 90,
  transactions: null,
  minBalance: 500,
  maxBalance: null,
};

export interface Party {
  name: string;
  address: string[];
  taxId: string;
  email: string;
}

export interface InvoiceLine {
  description: string;
  qty: number;
  unitPriceMinor: number;
  amountMinor: number;
  taxRateBps: number;
}

export interface TaxLine {
  label: string;
  rateBps: number;
  baseMinor: number;
  taxMinor: number;
}

export interface Invoice {
  _notice: string;
  number: string;
  region: InvoiceConfig["region"];
  currency: CurrencyCode;
  issueDate: string;
  dueDate: string;
  seller: Party;
  buyer: Party;
  lines: InvoiceLine[];
  subtotalMinor: number;
  taxLines: TaxLine[];
  taxTotalMinor: number;
  totalMinor: number;
  paymentTerms: string;
  paymentReference: string;
}

export interface Transaction {
  date: string;
  description: string;
  category: string;
  debitMinor: number | null;
  creditMinor: number | null;
  balanceMinor: number;
}

export interface Statement {
  _notice: string;
  bank: { name: string; address: string[] };
  accountHolder: { name: string; address: string[] };
  accountNumber: string;
  routingCode: string;
  currency: CurrencyCode;
  periodStart: string;
  periodEnd: string;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  totalCreditsMinor: number;
  totalDebitsMinor: number;
  lowestBalanceMinor: number;
  highestBalanceMinor: number;
  transactions: Transaction[];
  /** Constraints the statement was generated to satisfy. */
  constraints: StatementConfig;
}
