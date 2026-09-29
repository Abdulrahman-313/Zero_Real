import { z } from "zod";

export const MAX_CUSTOMERS = 2000;
export const MAX_TOTAL_ROWS = 50_000;

const range = (min: number, max: number) =>
  z.object({ min: z.number().int().min(min).max(max), max: z.number().int().min(min).max(max) });

export const relationalConfigSchema = z.object({
  customers: z.number().int().min(1).max(MAX_CUSTOMERS),
  /** 1:1 customers → customer_profiles. */
  profiles: z.object({ enabled: z.boolean(), coverage: z.number().min(0).max(100) }),
  /** 1:N customers → orders. */
  ordersPerCustomer: range(0, 20),
  /** 1:N orders → order_items. */
  itemsPerOrder: range(1, 30),
  products: z.number().int().min(1).max(1000),
  categories: z.number().int().min(1).max(20),
  /** N:N products ↔ categories via product_categories. */
  productCategories: z.object({ enabled: z.boolean(), min: z.number().int().min(1).max(10), max: z.number().int().min(1).max(10) }),
});

export type RelationalConfig = z.infer<typeof relationalConfigSchema>;

export const DEFAULT_RELATIONAL_CONFIG: RelationalConfig = {
  customers: 200,
  profiles: { enabled: true, coverage: 100 },
  ordersPerCustomer: { min: 1, max: 5 },
  itemsPerOrder: { min: 1, max: 4 },
  products: 60,
  categories: 8,
  productCategories: { enabled: true, min: 1, max: 3 },
};

/** Column kinds drive SQL types, CSV output and preview formatting. */
export type ColumnKind = "int" | "text" | "date" | "bool" | "money";

export interface ColumnDef {
  name: string;
  kind: ColumnKind;
  nullable?: boolean;
}

export interface ForeignKey {
  column: string;
  table: TableName;
  references: string;
}

export interface TableDef {
  name: TableName;
  columns: ColumnDef[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  unique: string[][];
}

export type TableName =
  | "customers"
  | "customer_profiles"
  | "products"
  | "categories"
  | "product_categories"
  | "orders"
  | "order_items";

export type RelCell = string | number | boolean | null;

export interface Table {
  def: TableDef;
  rows: RelCell[][];
}

export interface RelationalDataset {
  /** Tables in dependency order (parents before children). */
  tables: Table[];
  currency: string;
}

export const TABLE_DEFS: Record<TableName, TableDef> = {
  categories: {
    name: "categories",
    columns: [
      { name: "category_id", kind: "int" },
      { name: "name", kind: "text" },
    ],
    primaryKey: ["category_id"],
    foreignKeys: [],
    unique: [["name"]],
  },
  products: {
    name: "products",
    columns: [
      { name: "product_id", kind: "int" },
      { name: "sku", kind: "text" },
      { name: "name", kind: "text" },
      { name: "unit_price_minor", kind: "money" },
      { name: "currency", kind: "text" },
    ],
    primaryKey: ["product_id"],
    foreignKeys: [],
    unique: [["sku"]],
  },
  product_categories: {
    name: "product_categories",
    columns: [
      { name: "product_id", kind: "int" },
      { name: "category_id", kind: "int" },
    ],
    primaryKey: ["product_id", "category_id"],
    foreignKeys: [
      { column: "product_id", table: "products", references: "product_id" },
      { column: "category_id", table: "categories", references: "category_id" },
    ],
    unique: [],
  },
  customers: {
    name: "customers",
    columns: [
      { name: "customer_id", kind: "int" },
      { name: "name", kind: "text" },
      { name: "email", kind: "text" },
      { name: "signup_date", kind: "date" },
      { name: "country", kind: "text" },
    ],
    primaryKey: ["customer_id"],
    foreignKeys: [],
    unique: [["email"]],
  },
  customer_profiles: {
    name: "customer_profiles",
    columns: [
      { name: "profile_id", kind: "int" },
      { name: "customer_id", kind: "int" },
      { name: "tier", kind: "text" },
      { name: "marketing_opt_in", kind: "bool" },
    ],
    primaryKey: ["profile_id"],
    foreignKeys: [{ column: "customer_id", table: "customers", references: "customer_id" }],
    unique: [["customer_id"]],
  },
  orders: {
    name: "orders",
    columns: [
      { name: "order_id", kind: "int" },
      { name: "customer_id", kind: "int" },
      { name: "order_date", kind: "date" },
      { name: "status", kind: "text" },
      { name: "total_minor", kind: "money" },
    ],
    primaryKey: ["order_id"],
    foreignKeys: [{ column: "customer_id", table: "customers", references: "customer_id" }],
    unique: [],
  },
  order_items: {
    name: "order_items",
    columns: [
      { name: "item_id", kind: "int" },
      { name: "order_id", kind: "int" },
      { name: "product_id", kind: "int" },
      { name: "sku", kind: "text" },
      { name: "qty", kind: "int" },
      { name: "unit_price_minor", kind: "money" },
      { name: "line_total_minor", kind: "money" },
    ],
    primaryKey: ["item_id"],
    foreignKeys: [
      { column: "order_id", table: "orders", references: "order_id" },
      { column: "product_id", table: "products", references: "product_id" },
    ],
    unique: [],
  },
};

export function columnIndex(def: TableDef, column: string): number {
  const idx = def.columns.findIndex((c) => c.name === column);
  if (idx < 0) throw new Error(`Unknown column ${def.name}.${column}`);
  return idx;
}

export function getTable(dataset: RelationalDataset, name: TableName): Table | undefined {
  return dataset.tables.find((t) => t.def.name === name);
}
