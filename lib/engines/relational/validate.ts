import { columnIndex, getTable, type RelationalConfig, type RelationalDataset, type Table } from "./schema";

export type CheckCategory = "orphans" | "mismatches" | "duplicates" | "cardinality";

export interface ValidationCheck {
  id: string;
  label: string;
  category: CheckCategory;
  violations: number;
  /** Up to three human-readable examples of violations. */
  examples: string[];
}

export interface ValidationReport {
  checks: ValidationCheck[];
  orphans: number;
  mismatches: number;
  duplicates: number;
  cardinality: number;
  ok: boolean;
}

function keyOf(row: readonly unknown[], idx: number[]): string {
  return idx.map((i) => String(row[i])).join("\u0001");
}

function collect(check: Omit<ValidationCheck, "violations" | "examples">) {
  const examples: string[] = [];
  let violations = 0;
  return {
    fail(example: string) {
      violations++;
      if (examples.length < 3) examples.push(example);
    },
    done(): ValidationCheck {
      return { ...check, violations, examples };
    },
  };
}

function uniqueCheck(table: Table, columns: string[], label: string, category: CheckCategory): ValidationCheck {
  const idx = columns.map((c) => columnIndex(table.def, c));
  const seen = new Set<string>();
  const c = collect({ id: `unique:${table.def.name}:${columns.join(",")}`, label, category });
  for (const row of table.rows) {
    const key = keyOf(row, idx);
    if (seen.has(key)) c.fail(`${table.def.name}(${columns.join(", ")}) = ${key.replace(/\u0001/g, ", ")} appears twice`);
    seen.add(key);
  }
  return c.done();
}

/**
 * Independently re-scans a dataset for integrity problems. It does not trust the
 * generator: every foreign key, unique key and total is recomputed from the rows.
 */
export function validateRelational(dataset: RelationalDataset, config?: RelationalConfig): ValidationReport {
  const checks: ValidationCheck[] = [];
  const byName = new Map(dataset.tables.map((t) => [t.def.name, t]));

  for (const table of dataset.tables) {
    // Primary and unique keys
    checks.push(uniqueCheck(table, table.def.primaryKey, `${table.def.name}: primary key is unique`, "duplicates"));
    for (const unique of table.def.unique) {
      const oneToOne = table.def.name === "customer_profiles" && unique[0] === "customer_id";
      checks.push(
        uniqueCheck(
          table,
          unique,
          oneToOne ? "customer_profiles: one profile per customer (1:1)" : `${table.def.name}: ${unique.join(", ")} is unique`,
          "duplicates",
        ),
      );
    }

    // Foreign keys
    for (const fk of table.def.foreignKeys) {
      const parent = byName.get(fk.table);
      const c = collect({
        id: `fk:${table.def.name}.${fk.column}`,
        label: `${table.def.name}.${fk.column} → ${fk.table}.${fk.references}`,
        category: "orphans",
      });
      const childIdx = columnIndex(table.def, fk.column);
      const parentKeys = new Set<string>();
      if (parent) {
        const parentIdx = columnIndex(parent.def, fk.references);
        for (const row of parent.rows) parentKeys.add(String(row[parentIdx]));
      }
      for (const row of table.rows) {
        const value = row[childIdx];
        if (value === null || !parentKeys.has(String(value))) {
          c.fail(`${table.def.name} row with ${fk.column} = ${String(value)} has no matching ${fk.table}`);
        }
      }
      checks.push(c.done());
    }
  }

  const items = getTable(dataset, "order_items");
  const orders = getTable(dataset, "orders");
  const products = getTable(dataset, "products");
  const customers = getTable(dataset, "customers");

  if (items) {
    const qty = columnIndex(items.def, "qty");
    const unit = columnIndex(items.def, "unit_price_minor");
    const line = columnIndex(items.def, "line_total_minor");
    const itemId = columnIndex(items.def, "item_id");
    const c = collect({ id: "line-totals", label: "order_items: line total = qty × unit price", category: "mismatches" });
    for (const row of items.rows) {
      if (Number(row[qty]) * Number(row[unit]) !== Number(row[line])) c.fail(`item ${row[itemId]}: ${row[qty]} × ${row[unit]} ≠ ${row[line]}`);
    }
    checks.push(c.done());

    if (products) {
      const skuByProduct = new Map<string, unknown>();
      const pid = columnIndex(products.def, "product_id");
      const psku = columnIndex(products.def, "sku");
      for (const row of products.rows) skuByProduct.set(String(row[pid]), row[psku]);
      const ipid = columnIndex(items.def, "product_id");
      const isku = columnIndex(items.def, "sku");
      const s = collect({ id: "sku-match", label: "order_items: SKU matches its product", category: "mismatches" });
      for (const row of items.rows) {
        const expected = skuByProduct.get(String(row[ipid]));
        if (expected !== undefined && expected !== row[isku]) s.fail(`item ${row[itemId]}: SKU ${row[isku]} ≠ ${String(expected)}`);
      }
      checks.push(s.done());
    }
  }

  if (orders && items) {
    const oid = columnIndex(orders.def, "order_id");
    const total = columnIndex(orders.def, "total_minor");
    const iOrder = columnIndex(items.def, "order_id");
    const iLine = columnIndex(items.def, "line_total_minor");
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const row of items.rows) {
      const key = String(row[iOrder]);
      sums.set(key, (sums.get(key) ?? 0) + Number(row[iLine]));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const c = collect({ id: "order-totals", label: "orders: total = sum of line items", category: "mismatches" });
    for (const row of orders.rows) {
      const expected = sums.get(String(row[oid])) ?? 0;
      if (Number(row[total]) !== expected) c.fail(`order ${row[oid]}: total ${row[total]} ≠ items ${expected}`);
    }
    checks.push(c.done());

    if (config) {
      const k = collect({
        id: "items-per-order",
        label: `orders: ${config.itemsPerOrder.min}–${config.itemsPerOrder.max} items each (1:N)`,
        category: "cardinality",
      });
      for (const row of orders.rows) {
        const n = counts.get(String(row[oid])) ?? 0;
        if (n < config.itemsPerOrder.min || n > config.itemsPerOrder.max) k.fail(`order ${row[oid]} has ${n} items`);
      }
      checks.push(k.done());
    }
  }

  if (orders && customers) {
    const cid = columnIndex(customers.def, "customer_id");
    const signup = columnIndex(customers.def, "signup_date");
    const signupBy = new Map<string, string>();
    for (const row of customers.rows) signupBy.set(String(row[cid]), String(row[signup]));
    const oCustomer = columnIndex(orders.def, "customer_id");
    const oDate = columnIndex(orders.def, "order_date");
    const oid = columnIndex(orders.def, "order_id");
    const c = collect({ id: "order-after-signup", label: "orders: placed on or after customer signup", category: "mismatches" });
    const perCustomer = new Map<string, number>();
    for (const row of orders.rows) {
      const s = signupBy.get(String(row[oCustomer]));
      if (s !== undefined && String(row[oDate]) < s) c.fail(`order ${row[oid]} on ${row[oDate]} precedes signup ${s}`);
      perCustomer.set(String(row[oCustomer]), (perCustomer.get(String(row[oCustomer])) ?? 0) + 1);
    }
    checks.push(c.done());

    if (config) {
      const k = collect({
        id: "orders-per-customer",
        label: `customers: ${config.ordersPerCustomer.min}–${config.ordersPerCustomer.max} orders each (1:N)`,
        category: "cardinality",
      });
      for (const row of customers.rows) {
        const n = perCustomer.get(String(row[cid])) ?? 0;
        if (n < config.ordersPerCustomer.min || n > config.ordersPerCustomer.max) k.fail(`customer ${row[cid]} has ${n} orders`);
      }
      checks.push(k.done());
    }
  }

  const sum = (category: CheckCategory) => checks.filter((c) => c.category === category).reduce((n, c) => n + c.violations, 0);
  const report = {
    checks,
    orphans: sum("orphans"),
    mismatches: sum("mismatches"),
    duplicates: sum("duplicates"),
    cardinality: sum("cardinality"),
  };
  return { ...report, ok: report.orphans + report.mismatches + report.duplicates + report.cardinality === 0 };
}

/**
 * Returns a deep copy of the dataset with a few deliberate integrity violations,
 * used by the "tamper test" to prove the validator really checks the data.
 */
export function tamperDataset(dataset: RelationalDataset): { dataset: RelationalDataset; injected: string[] } {
  const tables = dataset.tables.map((t) => ({ def: t.def, rows: t.rows.map((r) => r.slice()) }));
  const copy: RelationalDataset = { ...dataset, tables };
  const injected: string[] = [];

  const items = tables.find((t) => t.def.name === "order_items");
  const orders = tables.find((t) => t.def.name === "orders");
  if (items && items.rows.length > 0) {
    items.rows[0][columnIndex(items.def, "order_id")] = -1;
    injected.push("Orphaned order item (order_id = -1)");
  }
  if (orders && orders.rows.length > 1) {
    const idx = columnIndex(orders.def, "total_minor");
    orders.rows[1][idx] = Number(orders.rows[1][idx]) + 1;
    injected.push("Order total off by one minor unit");
  }
  const customers = tables.find((t) => t.def.name === "customers");
  if (customers && customers.rows.length > 1) {
    customers.rows.push(customers.rows[0].slice());
    injected.push("Duplicated customer row (repeated primary key)");
  }
  return { dataset: copy, injected };
}
