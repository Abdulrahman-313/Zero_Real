import { MAX_STATEMENT_DAYS, MAX_TRANSACTIONS, type StatementConfig } from "./schema";

export type StatementQueryResult =
  | { ok: true; config: StatementConfig; chips: string[] }
  | { ok: false; error: string };

export const QUERY_EXAMPLES = [
  "last 90 days, balance over $500",
  "60 days, at least 40 transactions, balance under 2000",
  "last 6 months, balance between 1,000 and 5,000",
  "2 weeks, 25 transactions",
];

const AMOUNT = String.raw`(?:[$£€]|rs\.?\s*|pkr\s*|usd\s*|gbp\s*|eur\s*)?(-?\d[\d,]*(?:\.\d+)?)\s*(k|m)?`;

function parseAmount(num: string, suffix: string | undefined): number {
  const n = Number(num.replace(/,/g, ""));
  const mult = suffix?.toLowerCase() === "k" ? 1_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
  return n * mult;
}

/**
 * Parses query-style statement requests such as "last 90 days, balance over $500".
 * Unmentioned constraints are cleared; an unmentioned window keeps the current value.
 */
export function parseStatementQuery(text: string, current: StatementConfig): StatementQueryResult {
  let rest = ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
  if (rest.trim() === "") return { ok: false, error: "Type a request, for example “last 90 days, balance over $500”." };

  const chips: string[] = [];
  let days: number | null = null;
  let transactions: number | null = null;
  let minBalance: number | null = null;
  let maxBalance: number | null = null;

  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest);
    if (m) rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return m;
  };

  // Transaction count first, so "at least 20 transactions" is not read as a balance.
  const tx = take(/(?:at least|exactly|about|around|~)?\s*(\d+)\s*(?:transactions?|txns?|entries|payments)\b/);
  if (tx) transactions = Number(tx[1]);

  const named = take(/\b(?:last|past|previous)\s+(quarter|year|month|week)\b/);
  if (named) days = { quarter: 90, year: 365, month: 30, week: 7 }[named[1] as "quarter" | "year" | "month" | "week"];
  const win = !named && take(/\b(?:last|past|previous)?\s*(\d+)\s*(days?|d|weeks?|wks?|months?|mos?)\b/);
  if (win) {
    const n = Number(win[1]);
    const unit = win[2];
    days = unit.startsWith("w") ? n * 7 : unit.startsWith("m") ? n * 30 : n;
  }

  const between = take(new RegExp(String.raw`between\s*${AMOUNT}\s*(?:and|-|to)\s*${AMOUNT}`));
  if (between) {
    minBalance = parseAmount(between[1], between[2]);
    maxBalance = parseAmount(between[3], between[4]);
  }
  const over = take(new RegExp(String.raw`(?:over|above|at least|min(?:imum)?(?: of)?|>=?|more than|greater than|no less than|never below|stays? above)\s*${AMOUNT}`));
  if (over) minBalance = parseAmount(over[1], over[2]);
  const under = take(new RegExp(String.raw`(?:under|below|at most|max(?:imum)?(?: of)?|<=?|less than|no more than|never above|stays? below)\s*${AMOUNT}`));
  if (under) maxBalance = parseAmount(under[1], under[2]);

  if (days === null && transactions === null && minBalance === null && maxBalance === null) {
    return { ok: false, error: `I couldn't find a time window, balance or transaction count. Try “${QUERY_EXAMPLES[0]}”.` };
  }

  if (days !== null && (days < 7 || days > MAX_STATEMENT_DAYS)) {
    return { ok: false, error: `The window must be between 7 and ${MAX_STATEMENT_DAYS} days (got ${days}).` };
  }
  if (transactions !== null && (transactions < 5 || transactions > MAX_TRANSACTIONS)) {
    return { ok: false, error: `Transactions must be between 5 and ${MAX_TRANSACTIONS} (got ${transactions}).` };
  }
  if (minBalance !== null && maxBalance !== null && minBalance >= maxBalance) {
    return { ok: false, error: "The minimum balance must be lower than the maximum balance." };
  }

  const config: StatementConfig = {
    days: days ?? current.days,
    transactions,
    minBalance,
    maxBalance,
  };
  chips.push(`${config.days} days`);
  if (transactions !== null) chips.push(`${transactions} transactions`);
  if (minBalance !== null) chips.push(`balance ≥ ${minBalance.toLocaleString()}`);
  if (maxBalance !== null) chips.push(`balance ≤ ${maxBalance.toLocaleString()}`);
  return { ok: true, config, chips };
}
