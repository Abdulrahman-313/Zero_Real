import { dayToDate, dayToIso, isoToDay } from "../shared/dates";
import type { GlobalSettings } from "../shared/locales";
import { toMinor } from "../shared/money";
import { getFaker, makeCity, makePerson } from "../shared/people";
import { createRng, deriveSeed, type Rng } from "../shared/rng";
import { BANK_NAMES, MERCHANTS, STREETS, SYNTHETIC_NOTICE, type MerchantCategory } from "./pools";
import { PRICE_SCALE, statementConfigSchema, type Statement, type StatementConfig, type Transaction } from "./schema";

interface RawTxn {
  day: number;
  order: number;
  description: string;
  category: MerchantCategory;
  /** Signed amount in minor units: positive = credit, negative = debit. */
  amount: number;
  priority: number;
}

const RANDOM_EVENTS: Array<{ category: MerchantCategory; perDay: number; min: number; max: number; credit?: boolean; weight: number }> = [
  { category: "groceries", perDay: 0.35, min: 12, max: 120, weight: 30 },
  { category: "dining", perDay: 0.3, min: 8, max: 65, weight: 25 },
  { category: "transport", perDay: 0.25, min: 3, max: 60, weight: 20 },
  { category: "shopping", perDay: 0.08, min: 15, max: 250, weight: 10 },
  { category: "health", perDay: 0.02, min: 9, max: 140, weight: 3 },
  { category: "atm", perDay: 0.04, min: 20, max: 100, weight: 5 },
  { category: "transfer", perDay: 0.03, min: 20, max: 300, credit: true, weight: 4 },
];

function dayOfMonth(day: number): number {
  return dayToDate(day).getUTCDate();
}

export function validateStatementConfig(config: StatementConfig): string[] {
  const parsed = statementConfigSchema.safeParse(config);
  if (!parsed.success) return parsed.error.issues.slice(0, 3).map((i) => `Invalid ${i.path.join(".")}: ${i.message}`);
  if (config.minBalance !== null && config.maxBalance !== null && config.minBalance >= config.maxBalance)
    return ["The minimum balance must be lower than the maximum balance."];
  return [];
}

function prefixExtremes(amounts: number[]): { min: number; max: number } {
  let s = 0;
  let min = 0;
  let max = 0;
  for (const a of amounts) {
    s += a;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  return { min, max };
}

function randomEventTxn(day: number, order: number, event: (typeof RANDOM_EVENTS)[number], scale: number, rng: Rng, currency: GlobalSettings["currency"]): RawTxn {
  let major = rng.float(event.min, event.max) * scale;
  if (event.category === "atm") major = rng.pick([20, 40, 60, 100]) * scale;
  const description =
    event.category === "transfer" ? "Faster payment received" : rng.pick(MERCHANTS[event.category]);
  const amount = Math.max(1, toMinor(major, currency));
  return { day, order, description, category: event.category, amount: event.credit ? amount : -amount, priority: 9 };
}

/**
 * Generates a bank statement whose running balance is always exact
 * (balance[i] = balance[i-1] + credit − debit, in integer minor units) and that
 * satisfies the requested balance floor/ceiling across every row.
 */
export function generateStatement(config: StatementConfig, settings: GlobalSettings, asOf: string): Statement {
  const issues = validateStatementConfig(config);
  if (issues.length > 0) throw new Error(issues[0]);

  const { seed, currency, locale } = settings;
  const scale = PRICE_SCALE[currency];
  const rng = createRng(deriveSeed(seed, "statement"));
  const end = isoToDay(asOf);
  const start = end - config.days + 1;

  // Recurring monthly pattern, fixed per account.
  const payroll = toMinor(rng.float(2200, 4800) * scale, currency);
  const rent = toMinor(Math.round(rng.float(900, 2000) / 5) * 5 * scale, currency);
  const utility = rng.pick(MERCHANTS.utilities);
  const broadband = "Linkwave Broadband";
  const broadbandFee = toMinor(rng.float(30, 60) * scale, currency);
  const subscriptions = rng.sample(MERCHANTS.subscriptions, rng.int(1, 3)).map((name) => ({ name, fee: toMinor(rng.float(5, 18) * scale, currency), dom: rng.int(3, 27) }));
  const savingsDom = rng.int(26, 28);

  const txns: RawTxn[] = [];
  let order = 0;
  for (let day = start; day <= end; day++) {
    const dom = dayOfMonth(day);
    const drng = createRng(deriveSeed(seed, "statement-day", day));
    if (dom === 25) txns.push({ day, order: order++, description: MERCHANTS.payroll[0], category: "payroll", amount: payroll, priority: 0 });
    if (dom === 1) txns.push({ day, order: order++, description: MERCHANTS.rent[0], category: "rent", amount: -rent, priority: 1 });
    if (dom === 8)
      txns.push({ day, order: order++, description: utility === broadband ? MERCHANTS.utilities[0] : utility, category: "utilities", amount: -toMinor(drng.float(55, 160) * scale, currency), priority: 2 });
    if (dom === 15) txns.push({ day, order: order++, description: broadband, category: "utilities", amount: -broadbandFee, priority: 2 });
    for (const sub of subscriptions) {
      if (dom === sub.dom) txns.push({ day, order: order++, description: sub.name, category: "subscriptions", amount: -sub.fee, priority: 3 });
    }
    if (dom === savingsDom)
      txns.push({ day, order: order++, description: "Transfer to savings", category: "transfer", amount: -toMinor(Math.round(drng.float(100, 400) / 10) * 10 * scale, currency), priority: 4 });

    if (config.transactions === null) {
      for (const event of RANDOM_EVENTS) {
        if (drng.chance(event.perDay)) txns.push(randomEventTxn(day, order++, event, scale, drng, currency));
      }
    }
  }

  let list = txns;
  if (config.transactions !== null) {
    const target = config.transactions;
    if (list.length >= target) {
      // Keep the most important recurring items, then restore date order.
      list = [...list].sort((a, b) => a.priority - b.priority || a.day - b.day).slice(0, target);
    } else {
      const erng = createRng(deriveSeed(seed, "statement-events"));
      const weights = RANDOM_EVENTS.map((e) => e.weight);
      for (let k = list.length; k < target; k++) {
        const event = erng.weighted(RANDOM_EVENTS, weights);
        list.push(randomEventTxn(erng.int(start, end), order++, event, scale, erng, currency));
      }
    }
  }
  list.sort((a, b) => a.day - b.day || (b.amount > 0 ? 1 : 0) - (a.amount > 0 ? 1 : 0) || a.order - b.order);

  // Fit the balance constraints by choosing the opening balance (and scaling amounts if the band is tight).
  const floor = config.minBalance !== null ? toMinor(config.minBalance, currency) : null;
  const ceiling = config.maxBalance !== null ? toMinor(config.maxBalance, currency) : null;
  let amounts = list.map((t) => t.amount);
  let ext = prefixExtremes(amounts);
  if (floor !== null && ceiling !== null) {
    const band = ceiling - floor;
    for (let attempt = 0; attempt < 20 && ext.max - ext.min > band; attempt++) {
      const f = (0.9 * band) / Math.max(1, ext.max - ext.min);
      amounts = amounts.map((a) => Math.sign(a) * Math.max(1, Math.round(Math.abs(a) * f)));
      ext = prefixExtremes(amounts);
    }
    if (ext.max - ext.min > band) {
      throw new Error("The balance range is too narrow for this many transactions. Widen it or reduce transactions.");
    }
  }
  const spread = ext.max - ext.min;
  const orng = createRng(deriveSeed(seed, "statement-opening"));
  let opening: number;
  if (floor !== null && ceiling !== null) {
    const slack = ceiling - floor - spread;
    opening = floor - ext.min + Math.round(orng.float(0.1, 0.9) * slack);
  } else if (floor !== null) {
    opening = floor - ext.min + Math.round(orng.float(0.05, 0.3) * Math.max(spread, Math.abs(floor), toMinor(200 * scale, currency)));
  } else if (ceiling !== null) {
    opening = ceiling - ext.max - Math.round(orng.float(0.05, 0.3) * Math.max(spread, toMinor(200 * scale, currency)));
  } else {
    // No constraint: a realistic cushion so the account never goes overdrawn.
    opening = toMinor(orng.float(150, 1500) * scale, currency) - ext.min;
  }

  let balance = opening;
  let credits = 0;
  let debits = 0;
  let lowest = opening;
  let highest = opening;
  const transactions: Transaction[] = list.map((t, i) => {
    const amount = amounts[i];
    balance += amount;
    if (amount >= 0) credits += amount;
    else debits += -amount;
    lowest = Math.min(lowest, balance);
    highest = Math.max(highest, balance);
    return {
      date: dayToIso(t.day),
      description: t.description,
      category: t.category,
      debitMinor: amount < 0 ? -amount : null,
      creditMinor: amount >= 0 ? amount : null,
      balanceMinor: balance,
    };
  });

  const faker = getFaker(locale);
  const hrng = createRng(deriveSeed(seed, "statement-holder"));
  faker.seed(deriveSeed(seed, "statement-holder-faker"));
  const holder = makePerson(locale, faker, hrng);
  const city = makeCity(locale, faker, hrng);
  const bankName = hrng.pick(BANK_NAMES);
  const d = (n: number) => Array.from({ length: n }, () => hrng.int(0, 9)).join("");
  const ibanStyle = locale === "de-DE" || locale === "en-GB";

  return {
    _notice: SYNTHETIC_NOTICE,
    bank: { name: bankName, address: [`${hrng.int(1, 99)} ${hrng.pick(STREETS)}`, city] },
    accountHolder: { name: `${holder.first} ${holder.last}`, address: [`${hrng.int(2, 300)} ${hrng.pick(STREETS)}`, city] },
    accountNumber: ibanStyle ? `XX00 TEST 0000 ${d(4)} ${d(2)}` : `TEST-0000-${d(4)}-${d(4)}`,
    routingCode: `00-TEST-${d(2)}`,
    currency,
    periodStart: dayToIso(start),
    periodEnd: dayToIso(end),
    openingBalanceMinor: opening,
    closingBalanceMinor: balance,
    totalCreditsMinor: credits,
    totalDebitsMinor: debits,
    lowestBalanceMinor: lowest,
    highestBalanceMinor: highest,
    transactions,
    constraints: config,
  };
}
