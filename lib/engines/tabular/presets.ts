import { makeColumn } from "./columns";
import type { Column, TabularConfig } from "./schema";

export interface TabularPreset {
  id: string;
  label: string;
  description: string;
  columns: Column[];
}

function col<T extends Column>(column: T, patch: Partial<T> = {}): T {
  return { ...column, ...patch };
}

export const TABULAR_PRESETS: TabularPreset[] = [
  {
    id: "customers",
    label: "Customers",
    description: "IDs, names, emails, signup dates and balances.",
    columns: [
      col(makeColumn("id", "id", "customers-id"), { start: 10231 }),
      makeColumn("name", "name", "customers-name"),
      makeColumn("email", "email", "customers-email"),
      col(makeColumn("date", "signup", "customers-signup"), { min: "2024-06-01", max: "2025-06-30" }),
      col(makeColumn("currency", "balance", "customers-balance"), { min: 10, max: 2500 }),
      makeColumn("category", "tier", "customers-tier"),
      col(makeColumn("boolean", "active", "customers-active"), { trueProbability: 0.8 }),
    ] as Column[],
  },
  {
    id: "products",
    label: "Products",
    description: "SKUs, descriptions, prices and stock levels.",
    columns: [
      col(makeColumn("id", "product_id", "products-id"), { mode: "uuid" }),
      col(makeColumn("text", "description", "products-description"), { kind: "product" }),
      col(makeColumn("category", "department", "products-department"), {
        values: [
          { value: "Home", weight: 4 },
          { value: "Office", weight: 3 },
          { value: "Outdoor", weight: 2 },
          { value: "Kitchen", weight: 3 },
        ],
      }),
      col(makeColumn("currency", "price", "products-price"), { min: 4, max: 250, distribution: "lognormal" }),
      col(makeColumn("number", "stock", "products-stock"), { min: 0, max: 500, distribution: "uniform" }),
      col(makeColumn("number", "rating", "products-rating"), { min: 1, max: 5, decimals: 1, distribution: "normal" }),
    ] as Column[],
  },
  {
    id: "transactions",
    label: "Transactions",
    description: "Payments with memos — good for privacy and outlier demos.",
    columns: [
      col(makeColumn("id", "txn_id", "transactions-id"), { start: 500001 }),
      col(makeColumn("name", "account_holder", "transactions-holder"), { privacy: "mask" }),
      col(makeColumn("email", "email", "transactions-email"), { privacy: "hash" }),
      col(makeColumn("date", "posted_on", "transactions-date"), { min: "2025-01-01", max: "2025-06-30" }),
      col(makeColumn("currency", "amount", "transactions-amount"), { min: 1, max: 900, privacy: "noise" }),
      col(makeColumn("text", "memo", "transactions-memo"), { kind: "memo" }),
      col(makeColumn("category", "channel", "transactions-channel"), {
        values: [
          { value: "Card", weight: 6 },
          { value: "Bank transfer", weight: 3 },
          { value: "Wallet", weight: 2 },
        ],
      }),
    ] as Column[],
  },
];

export const DEFAULT_TABULAR_CONFIG: TabularConfig = {
  columns: TABULAR_PRESETS[0].columns,
  rowCount: 1000,
  nullRate: 0,
  outlierRate: 0,
  edgeCases: { kinds: [], rate: 5 },
  textPools: {},
};
