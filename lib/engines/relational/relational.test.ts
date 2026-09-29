import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { sqlLiteral, toPostgresDump } from "@/lib/export/sql";
import { createZip } from "@/lib/export/zip";
import type { GlobalSettings } from "../shared/locales";
import { generateRelational, totalRows, validateRelationalConfig, worstCaseRows } from "./generate";
import { DEFAULT_RELATIONAL_CONFIG, columnIndex, getTable, type RelationalConfig } from "./schema";
import { tamperDataset, validateRelational } from "./validate";

const settings: GlobalSettings = { seed: 42, locale: "en-US", currency: "USD" };

describe("relational FK integrity", () => {
  it("has 0 orphans, 0 mismatches and 0 duplicates across many seeds", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const ds = generateRelational(DEFAULT_RELATIONAL_CONFIG, { ...settings, seed });
      const report = validateRelational(ds, DEFAULT_RELATIONAL_CONFIG);
      expect(report.orphans).toBe(0);
      expect(report.mismatches).toBe(0);
      expect(report.duplicates).toBe(0);
      expect(report.cardinality).toBe(0);
      expect(report.ok).toBe(true);
    }
  });

  it("holds for edge configurations (0 orders, tiny catalog, partial 1:1 coverage)", () => {
    const configs: RelationalConfig[] = [
      { ...DEFAULT_RELATIONAL_CONFIG, ordersPerCustomer: { min: 0, max: 0 } },
      { ...DEFAULT_RELATIONAL_CONFIG, products: 2, itemsPerOrder: { min: 3, max: 5 } },
      { ...DEFAULT_RELATIONAL_CONFIG, profiles: { enabled: true, coverage: 60 } },
      { ...DEFAULT_RELATIONAL_CONFIG, profiles: { enabled: false, coverage: 100 }, productCategories: { enabled: false, min: 1, max: 1 } },
      { ...DEFAULT_RELATIONAL_CONFIG, categories: 3, productCategories: { enabled: true, min: 3, max: 3 } },
    ];
    for (const config of configs) {
      const ds = generateRelational(config, settings);
      expect(validateRelational(ds, config).ok).toBe(true);
    }
  });

  it("every order total equals the sum of its line items", () => {
    const ds = generateRelational(DEFAULT_RELATIONAL_CONFIG, settings);
    const orders = getTable(ds, "orders")!;
    const items = getTable(ds, "order_items")!;
    const sums = new Map<number, number>();
    for (const row of items.rows) {
      const orderId = row[columnIndex(items.def, "order_id")] as number;
      sums.set(orderId, (sums.get(orderId) ?? 0) + (row[columnIndex(items.def, "line_total_minor")] as number));
    }
    for (const row of orders.rows) {
      expect(row[columnIndex(orders.def, "total_minor")]).toBe(sums.get(row[0] as number) ?? 0);
    }
  });

  it("respects 1:1 coverage and N:N bounds", () => {
    const config: RelationalConfig = { ...DEFAULT_RELATIONAL_CONFIG, profiles: { enabled: true, coverage: 100 } };
    const ds = generateRelational(config, settings);
    expect(getTable(ds, "customer_profiles")!.rows).toHaveLength(config.customers);
    const pc = getTable(ds, "product_categories")!;
    const perProduct = new Map<number, number>();
    for (const [p] of pc.rows) perProduct.set(p as number, (perProduct.get(p as number) ?? 0) + 1);
    for (const n of perProduct.values()) {
      expect(n).toBeGreaterThanOrEqual(config.productCategories.min);
      expect(n).toBeLessThanOrEqual(config.productCategories.max);
    }
  });
});

describe("relational determinism", () => {
  it("same seed → identical dataset; different seed → different dataset", () => {
    const a = generateRelational(DEFAULT_RELATIONAL_CONFIG, settings);
    const b = generateRelational(DEFAULT_RELATIONAL_CONFIG, settings);
    const c = generateRelational(DEFAULT_RELATIONAL_CONFIG, { ...settings, seed: 7 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("relational validator", () => {
  it("catches deliberately injected violations (tamper test)", () => {
    const ds = generateRelational(DEFAULT_RELATIONAL_CONFIG, settings);
    const { dataset, injected } = tamperDataset(ds);
    const report = validateRelational(dataset, DEFAULT_RELATIONAL_CONFIG);
    expect(injected).toHaveLength(3);
    expect(report.ok).toBe(false);
    expect(report.orphans).toBeGreaterThanOrEqual(1);
    expect(report.mismatches).toBeGreaterThanOrEqual(2); // wrong total + orphaned item's order now short
    expect(report.duplicates).toBeGreaterThanOrEqual(1);
    // The original dataset is untouched.
    expect(validateRelational(ds, DEFAULT_RELATIONAL_CONFIG).ok).toBe(true);
  });

  it("rejects configs that could exceed the row cap or have inverted ranges", () => {
    const huge: RelationalConfig = { ...DEFAULT_RELATIONAL_CONFIG, customers: 2000, ordersPerCustomer: { min: 1, max: 20 }, itemsPerOrder: { min: 1, max: 30 } };
    expect(worstCaseRows(huge)).toBeGreaterThan(50_000);
    expect(validateRelationalConfig(huge)[0]).toMatch(/limit/);
    const inverted = { ...DEFAULT_RELATIONAL_CONFIG, itemsPerOrder: { min: 5, max: 2 } };
    expect(validateRelationalConfig(inverted)[0]).toMatch(/minimum/);
  });
});

describe("postgres dump", () => {
  it("escapes literals safely", () => {
    expect(sqlLiteral("O'Brien", "text")).toBe("'O''Brien'");
    expect(sqlLiteral("back\\slash", "text")).toBe("'back\\slash'");
    expect(sqlLiteral(null, "text")).toBe("NULL");
    expect(sqlLiteral(true, "bool")).toBe("TRUE");
    expect(sqlLiteral(12.9, "int")).toBe("12");
  });

  it("loads cleanly into Postgres with all constraints and matching row counts", async () => {
    const config: RelationalConfig = { ...DEFAULT_RELATIONAL_CONFIG, customers: 80 };
    const ds = generateRelational(config, { ...settings, locale: "de-DE", currency: "EUR" });
    const sql = toPostgresDump(ds, { seed: 42, generatedFor: "test" });
    const db = new PGlite();
    await db.exec(sql);
    for (const table of ds.tables) {
      const res = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table.def.name}`);
      expect(res.rows[0].n).toBe(table.rows.length);
    }
    const mismatch = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM orders o
       LEFT JOIN (SELECT order_id, sum(line_total_minor) AS s FROM order_items GROUP BY order_id) i USING (order_id)
       WHERE o.total_minor <> coalesce(i.s, 0)`,
    );
    expect(mismatch.rows[0].n).toBe(0);
    // Dump is re-runnable (drops and recreates).
    await db.exec(sql);
    await db.close();
  }, 60_000);
});

describe("zip bundle", () => {
  it("writes a valid STORE archive", () => {
    const zip = createZip([
      { name: "a.csv", content: "x,y\r\n1,2\r\n" },
      { name: "ü.csv", content: "é" },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 12, true)).toBe(2);
  });
});

describe("relational size", () => {
  it("counts rows across tables", () => {
    const ds = generateRelational(DEFAULT_RELATIONAL_CONFIG, settings);
    expect(totalRows(ds)).toBe(ds.tables.reduce((n, t) => n + t.rows.length, 0));
    expect(totalRows(ds)).toBeLessThanOrEqual(worstCaseRows(DEFAULT_RELATIONAL_CONFIG));
  });
});
