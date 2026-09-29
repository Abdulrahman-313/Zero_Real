import { describe, expect, it } from "vitest";
import { applyRateBps } from "../shared/money";
import type { GlobalSettings } from "../shared/locales";
import { computeTotals, generateInvoices } from "./invoice";
import { BANK_NAMES, SYNTHETIC_NOTICE } from "./pools";
import { parseStatementQuery } from "./query";
import { DEFAULT_INVOICE_CONFIG, DEFAULT_STATEMENT_CONFIG, type Invoice, type InvoiceConfig, type StatementConfig } from "./schema";
import { generateStatement } from "./statement";
import { REGION_TEMPLATES, US_STATE_RATES } from "./tax";

const AS_OF = "2025-09-15";
const us: GlobalSettings = { seed: 42, locale: "en-US", currency: "USD" };
const uk: GlobalSettings = { seed: 42, locale: "en-GB", currency: "GBP" };
const pk: GlobalSettings = { seed: 42, locale: "en-PK", currency: "PKR" };

function assertReconciles(inv: Invoice) {
  for (const line of inv.lines) expect(line.amountMinor).toBe(line.qty * line.unitPriceMinor);
  const subtotal = inv.lines.reduce((s, l) => s + l.amountMinor, 0);
  expect(inv.subtotalMinor).toBe(subtotal);
  const baseSum = inv.taxLines.reduce((s, t) => s + t.baseMinor, 0);
  expect(baseSum).toBe(subtotal);
  for (const t of inv.taxLines) expect(t.taxMinor).toBe(applyRateBps(t.baseMinor, t.rateBps));
  expect(inv.taxTotalMinor).toBe(inv.taxLines.reduce((s, t) => s + t.taxMinor, 0));
  expect(inv.totalMinor).toBe(inv.subtotalMinor + inv.taxTotalMinor);
  for (const v of [inv.subtotalMinor, inv.totalMinor, inv.taxTotalMinor]) expect(Number.isInteger(v)).toBe(true);
}

describe("invoice totals", () => {
  it("reconcile exactly for every region across bulk generation and many seeds", () => {
    const cases: Array<[InvoiceConfig, GlobalSettings]> = [
      [{ ...DEFAULT_INVOICE_CONFIG, region: "US", usState: "CA", count: 50 }, us],
      [{ ...DEFAULT_INVOICE_CONFIG, region: "US", usState: "OR", count: 20 }, us],
      [{ ...DEFAULT_INVOICE_CONFIG, region: "UK", count: 50, lines: { min: 4, max: 10 } }, uk],
      [{ ...DEFAULT_INVOICE_CONFIG, region: "PK", count: 50 }, pk],
    ];
    for (const [config, settings] of cases) {
      for (const seed of [1, 7, 42, 999]) {
        for (const inv of generateInvoices(config, { ...settings, seed }, AS_OF)) assertReconciles(inv);
      }
    }
  });

  it("applies the region's tax rules", () => {
    const [usInv] = generateInvoices({ ...DEFAULT_INVOICE_CONFIG, region: "US", usState: "TX" }, us, AS_OF);
    expect(usInv.taxLines).toHaveLength(1);
    expect(usInv.taxLines[0].rateBps).toBe(US_STATE_RATES.TX.bps);
    expect(usInv.taxLines[0].label).toBe("Sales Tax 6.25%");

    const pkInvs = generateInvoices({ ...DEFAULT_INVOICE_CONFIG, region: "PK", count: 10 }, pk, AS_OF);
    for (const inv of pkInvs) expect(inv.taxLines.every((t) => t.rateBps === 1800 && t.label === "GST 18%")).toBe(true);

    const ukInvs = generateInvoices({ ...DEFAULT_INVOICE_CONFIG, region: "UK", count: 60, lines: { min: 6, max: 10 } }, uk, AS_OF);
    const rates = new Set(ukInvs.flatMap((inv) => inv.taxLines.map((t) => t.rateBps)));
    expect(rates.has(2000)).toBe(true);
    expect([...rates].every((r) => [0, 500, 2000].includes(r))).toBe(true);
    expect(REGION_TEMPLATES.UK.taxLabel).toBe("VAT");
  });

  it("rounds tax half-up per rate bucket", () => {
    const totals = computeTotals(
      [
        { description: "a", qty: 1, unitPriceMinor: 1999, amountMinor: 1999, taxRateBps: 2000 },
        { description: "b", qty: 3, unitPriceMinor: 5, amountMinor: 15, taxRateBps: 500 },
      ],
      "VAT",
    );
    expect(totals.taxLines.map((t) => t.taxMinor)).toEqual([400, 1]); // 399.8 → 400, 0.75 → 1
    expect(totals.totalMinor).toBe(2014 + 401);
  });

  it("is deterministic, bulk-stable and carries the synthetic notice and fake IDs", () => {
    const config = { ...DEFAULT_INVOICE_CONFIG, count: 25 };
    const a = generateInvoices(config, us, AS_OF);
    const b = generateInvoices(config, us, AS_OF);
    expect(a).toEqual(b);
    expect(generateInvoices({ ...config, count: 5 }, us, AS_OF)).toEqual(a.slice(0, 5));
    expect(new Set(a.map((i) => i.number)).size).toBe(25);
    for (const inv of a) {
      expect(inv._notice).toBe(SYNTHETIC_NOTICE);
      expect(inv.seller.taxId).toMatch(/TEST/);
      expect(inv.buyer.taxId).toMatch(/TEST/);
      expect(inv.buyer.email).toMatch(/\.example$/);
      expect(inv.dueDate > inv.issueDate).toBe(true);
    }
  });
});

describe("bank statement running balance", () => {
  function assertBalances(config: StatementConfig, settings: GlobalSettings) {
    const st = generateStatement(config, settings, AS_OF);
    let balance = st.openingBalanceMinor;
    let credits = 0;
    let debits = 0;
    for (const t of st.transactions) {
      expect((t.debitMinor === null) !== (t.creditMinor === null)).toBe(true);
      balance += (t.creditMinor ?? 0) - (t.debitMinor ?? 0);
      credits += t.creditMinor ?? 0;
      debits += t.debitMinor ?? 0;
      expect(t.balanceMinor).toBe(balance);
      expect(t.date >= st.periodStart && t.date <= st.periodEnd).toBe(true);
    }
    expect(st.closingBalanceMinor).toBe(balance);
    expect(st.closingBalanceMinor).toBe(st.openingBalanceMinor + credits - debits);
    expect(st.totalCreditsMinor).toBe(credits);
    expect(st.totalDebitsMinor).toBe(debits);
    const dates = st.transactions.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
    return st;
  }

  it("is always correct and satisfies 'balance over $500' for many seeds", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const st = assertBalances(DEFAULT_STATEMENT_CONFIG, { ...us, seed });
      expect(st.openingBalanceMinor).toBeGreaterThanOrEqual(50000);
      expect(Math.min(...st.transactions.map((t) => t.balanceMinor))).toBeGreaterThanOrEqual(50000);
      expect(st.lowestBalanceMinor).toBeGreaterThanOrEqual(50000);
    }
  });

  it("honours ceilings, bands, exact counts and windows", () => {
    const configs: StatementConfig[] = [
      { days: 60, transactions: 40, minBalance: null, maxBalance: 2000 },
      { days: 180, transactions: null, minBalance: 1000, maxBalance: 5000 },
      { days: 14, transactions: 25, minBalance: null, maxBalance: null },
      { days: 365, transactions: 600, minBalance: 0, maxBalance: 1500 },
      { days: 30, transactions: 5, minBalance: 100, maxBalance: null },
    ];
    for (const config of configs) {
      for (const settings of [us, uk, pk]) {
        const st = assertBalances(config, settings);
        const all = [st.openingBalanceMinor, ...st.transactions.map((t) => t.balanceMinor)];
        if (config.minBalance !== null) expect(Math.min(...all)).toBeGreaterThanOrEqual(config.minBalance * 100);
        if (config.maxBalance !== null) expect(Math.max(...all)).toBeLessThanOrEqual(config.maxBalance * 100);
        if (config.transactions !== null) expect(st.transactions).toHaveLength(config.transactions);
      }
    }
  });

  it("uses invented banks and obviously fake account numbers", () => {
    const st = generateStatement(DEFAULT_STATEMENT_CONFIG, uk, AS_OF);
    expect(BANK_NAMES).toContain(st.bank.name);
    expect(st.bank.name).toMatch(/Test|Sample/);
    expect(st.accountNumber).toMatch(/TEST/);
    expect(st._notice).toBe(SYNTHETIC_NOTICE);
  });

  it("is deterministic", () => {
    expect(generateStatement(DEFAULT_STATEMENT_CONFIG, us, AS_OF)).toEqual(generateStatement(DEFAULT_STATEMENT_CONFIG, us, AS_OF));
  });

  it("rejects impossible bands", () => {
    expect(() => generateStatement({ days: 30, transactions: null, minBalance: 900, maxBalance: 500 }, us, AS_OF)).toThrow(/lower/);
  });
});

describe("statement query parser", () => {
  const cur = DEFAULT_STATEMENT_CONFIG;
  it("parses the deck example", () => {
    const r = parseStatementQuery("last 90 days, balance over $500", cur);
    expect(r).toMatchObject({ ok: true, config: { days: 90, minBalance: 500, maxBalance: null, transactions: null } });
  });

  it("parses counts, ceilings, bands, units and suffixes", () => {
    expect(parseStatementQuery("60 days, at least 40 transactions, balance under 2000", cur)).toMatchObject({
      ok: true,
      config: { days: 60, transactions: 40, maxBalance: 2000, minBalance: null },
    });
    expect(parseStatementQuery("last 6 months, balance between 1,000 and 5,000", cur)).toMatchObject({
      ok: true,
      config: { days: 180, minBalance: 1000, maxBalance: 5000 },
    });
    expect(parseStatementQuery("past quarter, above £1.5k", cur)).toMatchObject({ ok: true, config: { days: 90, minBalance: 1500 } });
    expect(parseStatementQuery("2 weeks, 25 transactions", cur)).toMatchObject({ ok: true, config: { days: 14, transactions: 25 } });
  });

  it("returns friendly errors", () => {
    expect(parseStatementQuery("", cur).ok).toBe(false);
    expect(parseStatementQuery("hello there", cur).ok).toBe(false);
    expect(parseStatementQuery("900 days", cur).ok).toBe(false);
    expect(parseStatementQuery("balance over 900 and under 100", cur).ok).toBe(false);
  });
});
